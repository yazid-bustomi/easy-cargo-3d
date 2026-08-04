const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const ContainerType = require('./ContainerType');
const User = require('./User');

const Layout = sequelize.define(
  'Layout',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    container_type_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'container_types', key: 'id' },
    },
    odoo_sale_order_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'confirmed', 'archived'),
      defaultValue: 'draft',
    },
    total_weight_kg: {
      type: DataTypes.DECIMAL(12, 3),
      defaultValue: 0,
    },
    used_volume_cm3: {
      type: DataTypes.DECIMAL(20, 2),
      defaultValue: 0,
    },
    item_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
  },
  {
    tableName: 'layouts',
    timestamps: true,
    underscored: true,
  }
);

Layout.belongsTo(ContainerType, { as: 'containerType', foreignKey: 'container_type_id' });
Layout.belongsTo(User, { as: 'creator', foreignKey: 'created_by' });

module.exports = Layout;
