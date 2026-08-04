const bcrypt = require('bcryptjs');
const { sequelize, User, ContainerType, ProductGroup, Product } = require('../models');

async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    // Sync all models
    await sequelize.sync({ force: false });
    console.log('✓ Database synced');

    // Create default admin user
    const adminExists = await User.findOne({ where: { email: 'admin@easycargo.local' } });
    if (!adminExists) {
      const passwordHash = bcrypt.hashSync('admin123', 10);
      await User.create({
        name: 'Admin',
        email: 'admin@easycargo.local',
        password_hash: passwordHash,
        role: 'admin',
        is_active: true,
      });
      console.log('✓ Admin user created (admin@easycargo.local / admin123)');
    }

    // Create container types
    const containerTypes = [
      {
        code: 'CONT20',
        name: "Container 20'",
        length_cm: 580.0,
        width_cm: 235.2,
        height_cm: 238.5,
        max_payload_kg: 28180,
        tare_weight_kg: 2300,
        is_system: true,
        is_custom: false,
      },
      {
        code: 'CONT40',
        name: "Container 40'",
        length_cm: 1203.2,
        width_cm: 235.2,
        height_cm: 238.5,
        max_payload_kg: 28800,
        tare_weight_kg: 3800,
        is_system: true,
        is_custom: false,
      },
      {
        code: 'CONT40HC',
        name: "Container 40' HC (Safe)",
        length_cm: 1200.0,
        width_cm: 233.0,
        height_cm: 268.2,
        max_payload_kg: 28560,
        tare_weight_kg: 3900,
        is_system: true,
        is_custom: false,
      },
    ];

    for (const ct of containerTypes) {
      const exists = await ContainerType.findOne({ where: { code: ct.code } });
      if (!exists) {
        await ContainerType.create(ct);
      }
    }
    console.log('✓ Container types created');

    // Create default product group
    let defaultGroup = await ProductGroup.findOne({ where: { name: 'General Products' } });
    if (!defaultGroup) {
      defaultGroup = await ProductGroup.create({
        name: 'General Products',
        color_hex: '#3B82F6',
        sort_order: 1,
      });
    }

    // Create sample products
    const sampleProducts = [
      {
        group_id: defaultGroup.id,
        sku: 'BOX-001',
        name: 'Standard Carton 60x40x40',
        length_cm: 60,
        width_cm: 40,
        height_cm: 40,
        weight_kg: 5.0,
        qty: 10,
        this_side_up: false,
        rotation_allowed: true,
        stackable: true,
        max_stack: 5,
        color_hex: '#F59E0B',
      },
      {
        group_id: defaultGroup.id,
        sku: 'BOX-002',
        name: 'Large Carton 120x80x60',
        length_cm: 120,
        width_cm: 80,
        height_cm: 60,
        weight_kg: 15.0,
        qty: 5,
        this_side_up: true,
        rotation_allowed: false,
        stackable: true,
        max_stack: 3,
        color_hex: '#EF4444',
      },
      {
        group_id: defaultGroup.id,
        sku: 'BOX-003',
        name: 'Small Carton 30x20x20',
        length_cm: 30,
        width_cm: 20,
        height_cm: 20,
        weight_kg: 1.5,
        qty: 50,
        this_side_up: false,
        rotation_allowed: true,
        stackable: true,
        max_stack: 10,
        color_hex: '#10B981',
      },
    ];

    for (const product of sampleProducts) {
      const exists = await Product.findOne({ where: { sku: product.sku } });
      if (!exists) {
        await Product.create(product);
      }
    }
    console.log('✓ Sample products created');

    console.log('\n✅ Seeding completed successfully!');
    console.log('\nDefault Credentials:');
    console.log('Email: admin@easycargo.local');
    console.log('Password: admin123');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run seed if called directly
if (require.main === module) {
  seed().then(() => process.exit(0));
}

module.exports = { seed };
