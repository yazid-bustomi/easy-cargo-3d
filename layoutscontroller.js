const { Layout, LayoutItem, LayoutHistory, ContainerType, Product, sequelize } = require('../models');
const { packContainer } = require('../services/binPacking');

async function list(req, res) {
  const layouts = await Layout.findAll({
    include: [{ model: ContainerType, as: 'containerType' }],
    order: [['id', 'DESC']],
  });
  res.json(layouts);
}

async function getOne(req, res) {
  const layout = await Layout.findByPk(req.params.id, {
    include: [
      { model: ContainerType, as: 'containerType' },
      { model: LayoutItem, as: 'items', include: [{ model: Product, as: 'product' }] },
    ],
  });
  if (!layout) return res.status(404).json({ message: 'Layout not found' });
  res.json(layout);
}

async function create(req, res) {
  const { name, container_type_id } = req.body;
  const containerType = await ContainerType.findByPk(container_type_id);
  if (!containerType) return res.status(400).json({ message: 'Invalid container_type_id' });

  const layout = await Layout.create({
    name: name || `Layout ${new Date().toISOString()}`,
    container_type_id,
    created_by: req.user?.id || null,
  });
  res.status(201).json(layout);
}

async function update(req, res) {
  const layout = await Layout.findByPk(req.params.id);
  if (!layout) return res.status(404).json({ message: 'Layout not found' });
  const { name, status } = req.body;
  await layout.update({ name, status });
  res.json(layout);
}

async function remove(req, res) {
  const layout = await Layout.findByPk(req.params.id);
  if (!layout) return res.status(404).json({ message: 'Layout not found' });
  await layout.destroy();
  res.status(204).send();
}

/** Recalculate and persist aggregate stats (weight, used volume, item count) */
async function recalcStats(layoutId) {
  const items = await LayoutItem.findAll({ where: { layout_id: layoutId }, include: [{ model: Product, as: 'product' }] });
  let totalWeight = 0;
  let usedVolume = 0;
  for (const it of items) {
    if (!it.product) continue;
    totalWeight += Number(it.product.weight_kg);
    usedVolume += Number(it.product.length_cm) * Number(it.product.width_cm) * Number(it.product.height_cm);
  }
  await Layout.update(
    { total_weight_kg: totalWeight, used_volume_cm3: usedVolume, item_count: items.length },
    { where: { id: layoutId } }
  );
  return { totalWeight, usedVolume, itemCount: items.length };
}

/**
 * POST /layouts/:id/auto-insert
 * body: { productIds?: number[] }  -- if omitted, all active products are used
 * Runs the EMS bin-packing algorithm and appends placed items to the layout.
 * Returns per-product loaded/total counts, e.g. "43/47".
 */
async function autoInsert(req, res) {
  const layout = await Layout.findByPk(req.params.id, { include: [{ model: ContainerType, as: 'containerType' }] });
  if (!layout) return res.status(404).json({ message: 'Layout not found' });

  const { productIds } = req.body;
  const where = { is_active: true };
  if (Array.isArray(productIds) && productIds.length) where.id = productIds;
  const products = await Product.findAll({ where });
  if (!products.length) return res.status(400).json({ message: 'No products to insert' });

  // Existing items already occupy volume/weight — for simplicity, Auto Insert
  // clears previous placements of the SAME products before repacking them,
  // and preserves manually placed OTHER products already in the container.
  const existingItems = await LayoutItem.findAll({ where: { layout_id: layout.id } });
  const targetIds = new Set(products.map((p) => p.id));
  const keepItems = existingItems.filter((it) => !targetIds.has(it.product_id));

  const container = {
    length: Number(layout.containerType.length_cm),
    width: Number(layout.containerType.width_cm),
    height: Number(layout.containerType.height_cm),
    maxPayloadKg: Number(layout.containerType.max_payload_kg),
  };

  const items = products.map((p) => ({
    productId: p.id,
    length: Number(p.length_cm),
    width: Number(p.width_cm),
    height: Number(p.height_cm),
    weight: Number(p.weight_kg),
    thisSideUp: !!p.this_side_up,
    rotationAllowed: !!p.rotation_allowed,
    stackable: !!p.stackable,
    maxStack: p.max_stack,
    qty: p.qty,
  }));

  const result = packContainer(container, items);

  const t = await sequelize.transaction();
  try {
    await LayoutItem.destroy({ where: { layout_id: layout.id, product_id: Array.from(targetIds) }, transaction: t });
    const rows = result.placed.map((p) => ({
      layout_id: layout.id,
      product_id: p.productId,
      instance_no: p.instanceNo,
      pos_x: p.x,
      pos_y: p.y,
      pos_z: p.z,
      rot_x: p.rotX,
      rot_y: p.rotY,
      rot_z: p.rotZ,
      stack_level: p.stackLevel,
      is_valid: true,
    }));
    if (rows.length) await LayoutItem.bulkCreate(rows, { transaction: t });

    await LayoutHistory.create({
      layout_id: layout.id,
      snapshot: JSON.stringify([...keepItems.map((k) => k.toJSON()), ...rows]),
      action_type: 'auto_insert',
      created_by: req.user?.id || null,
    }, { transaction: t });

    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  const stats = await recalcStats(layout.id);

  // Build per-product loaded/total status strings like "43/47"
  const loadedCountByProduct = {};
  for (const p of result.placed) {
    loadedCountByProduct[p.productId] = (loadedCountByProduct[p.productId] || 0) + 1;
  }
  const status = products.map((p) => ({
    productId: p.id,
    sku: p.sku,
    name: p.name,
    loaded: loadedCountByProduct[p.id] || 0,
    total: p.qty,
    label: `${loadedCountByProduct[p.id] || 0}/${p.qty}`,
  }));

  res.json({ placed: result.placed.length, unplaced: result.unplaced, status, stats });
}

/**
 * PUT /layouts/:id/items
 * Full replace of layout items (used for manual save, reset layout, and
 * to persist the client's undo/redo state to the server).
 * body: { items: [{product_id,instance_no,pos_x,pos_y,pos_z,rot_x,rot_y,rot_z,stack_level,is_valid}], action_type }
 */
async function saveItems(req, res) {
  const layout = await Layout.findByPk(req.params.id);
  if (!layout) return res.status(404).json({ message: 'Layout not found' });

  const { items, action_type } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ message: 'items must be an array' });

  const t = await sequelize.transaction();
  try {
    await LayoutItem.destroy({ where: { layout_id: layout.id }, transaction: t });
    if (items.length) {
      await LayoutItem.bulkCreate(
        items.map((it) => ({ ...it, layout_id: layout.id })),
        { transaction: t }
      );
    }
    await LayoutHistory.create({
      layout_id: layout.id,
      snapshot: JSON.stringify(items),
      action_type: action_type || 'manual_save',
      created_by: req.user?.id || null,
    }, { transaction: t });
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  const stats = await recalcStats(layout.id);
  res.json({ message: 'Layout saved', stats });
}

/** PATCH /layouts/:id/items/:itemId — update a single item (drag/rotate) */
async function updateItem(req, res) {
  const item = await LayoutItem.findOne({ where: { id: req.params.itemId, layout_id: req.params.id } });
  if (!item) return res.status(404).json({ message: 'Layout item not found' });
  await item.update(req.body);
  res.json(item);
}

/** DELETE /layouts/:id/items/:itemId */
async function deleteItem(req, res) {
  const item = await LayoutItem.findOne({ where: { id: req.params.itemId, layout_id: req.params.id } });
  if (!item) return res.status(404).json({ message: 'Layout item not found' });
  await item.destroy();
  await recalcStats(req.params.id);
  res.status(204).send();
}

/** POST /layouts/:id/reset — clears all items */
async function resetLayout(req, res) {
  await LayoutItem.destroy({ where: { layout_id: req.params.id } });
  await LayoutHistory.create({ layout_id: req.params.id, snapshot: JSON.stringify([]), action_type: 'reset', created_by: req.user?.id || null });
  const stats = await recalcStats(req.params.id);
  res.json({ message: 'Layout reset', stats });
}

/** GET /layouts/:id/history — list snapshots for undo/redo restore fallback */
async function history(req, res) {
  const rows = await LayoutHistory.findAll({
    where: { layout_id: req.params.id },
    order: [['id', 'DESC']],
    limit: 50,
  });
  res.json(rows);
}

/** POST /layouts/:id/history/:historyId/restore */
async function restoreHistory(req, res) {
  const snap = await LayoutHistory.findOne({ where: { id: req.params.historyId, layout_id: req.params.id } });
  if (!snap) return res.status(404).json({ message: 'Snapshot not found' });
  const items = JSON.parse(snap.snapshot);

  const t = await sequelize.transaction();
  try {
    await LayoutItem.destroy({ where: { layout_id: req.params.id }, transaction: t });
    if (items.length) {
      await LayoutItem.bulkCreate(items.map((it) => ({ ...it, layout_id: Number(req.params.id) })), { transaction: t });
    }
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }
  const stats = await recalcStats(req.params.id);
  res.json({ message: 'Restored', stats });
}

/** GET /layouts/:id/export — export full layout as JSON */
async function exportJson(req, res) {
  const layout = await Layout.findByPk(req.params.id, {
    include: [
      { model: ContainerType, as: 'containerType' },
      { model: LayoutItem, as: 'items', include: [{ model: Product, as: 'product' }] },
    ],
  });
  if (!layout) return res.status(404).json({ message: 'Layout not found' });

  res.setHeader('Content-Disposition', `attachment; filename="layout-${layout.id}.json"`);
  res.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    layout: {
      id: layout.id,
      name: layout.name,
      containerType: layout.containerType,
      items: layout.items,
    },
  });
}

/** POST /layouts/:id/import — import a previously exported JSON layout */
async function importJson(req, res) {
  const layout = await Layout.findByPk(req.params.id);
  if (!layout) return res.status(404).json({ message: 'Layout not found' });

  const { items } = req.body.layout || req.body;
  if (!Array.isArray(items)) return res.status(400).json({ message: 'Invalid import file: items missing' });

  const t = await sequelize.transaction();
  try {
    await LayoutItem.destroy({ where: { layout_id: layout.id }, transaction: t });
    await LayoutItem.bulkCreate(
      items.map((it) => ({
        layout_id: layout.id,
        product_id: it.product_id || it.product?.id,
        instance_no: it.instance_no,
        pos_x: it.pos_x, pos_y: it.pos_y, pos_z: it.pos_z,
        rot_x: it.rot_x, rot_y: it.rot_y, rot_z: it.rot_z,
        stack_level: it.stack_level, is_valid: it.is_valid !== false,
      })),
      { transaction: t }
    );
    await LayoutHistory.create({ layout_id: layout.id, snapshot: JSON.stringify(items), action_type: 'import', created_by: req.user?.id || null }, { transaction: t });
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }
  const stats = await recalcStats(layout.id);
  res.json({ message: 'Layout imported', stats });
}

module.exports = {
  list, getOne, create, update, remove,
  autoInsert, saveItems, updateItem, deleteItem,
  resetLayout, history, restoreHistory, exportJson, importJson,
};