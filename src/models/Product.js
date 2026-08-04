const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const ProductGroup = require('./ProductGroup');
const User = require('./User');

const Product = sequelize.define(
  'Product',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    group_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'product_groups', key: 'id' },
    },
    sku: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    length_cm: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    width_cm: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    height_cm: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    weight_kg: {
      type: DataTypes.DECIMAL(10, 3),
      defaultValue: 0,
    },
    qty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    this_side_up: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    rotation_allowed: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    stackable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    max_stack: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    color_hex: {
      type: DataTypes.STRING(9),
      defaultValue: '#F59E0B',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    odoo_product_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    odoo_sale_order_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    odoo_last_sync_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    source: {
      type: DataTypes.ENUM('manual', 'odoo'),
      defaultValue: 'manual',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
  },
  {
    tableName: 'products',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['group_id'] },
      { fields: ['odoo_product_id'] },
    ],
  }
);

Product.belongsTo(ProductGroup, { as: 'group', foreignKey: 'group_id' });
Product.belongsTo(User, { as: 'creator', foreignKey: 'created_by' });

module.exports = Product;
