const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Layout = require('./Layout');
const Product = require('./Product');

const LayoutItem = sequelize.define(
  'LayoutItem',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    layout_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'layouts', key: 'id' },
      onDelete: 'CASCADE',
    },
    product_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'products', key: 'id' },
      onDelete: 'CASCADE',
    },
    instance_no: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    pos_x: {
      type: DataTypes.DECIMAL(10, 3),
      defaultValue: 0,
    },
    pos_y: {
      type: DataTypes.DECIMAL(10, 3),
      defaultValue: 0,
    },
    pos_z: {
      type: DataTypes.DECIMAL(10, 3),
      defaultValue: 0,
    },
    rot_x: {
      type: DataTypes.SMALLINT,
      defaultValue: 0,
    },
    rot_y: {
      type: DataTypes.SMALLINT,
      defaultValue: 0,
    },
    rot_z: {
      type: DataTypes.SMALLINT,
      defaultValue: 0,
    },
    stack_level: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    is_valid: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'layout_items',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['layout_id'] },
      { fields: ['product_id'] },
    ],
  }
);

LayoutItem.belongsTo(Layout, { as: 'layout', foreignKey: 'layout_id' });
LayoutItem.belongsTo(Product, { as: 'product', foreignKey: 'product_id' });

module.exports = LayoutItem;
