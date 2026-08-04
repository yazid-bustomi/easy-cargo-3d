const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const ProductGroup = sequelize.define(
  'ProductGroup',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    color_hex: {
      type: DataTypes.STRING(9),
      defaultValue: '#3B82F6',
    },
    is_collapsed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    sort_order: {
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
    tableName: 'product_groups',
    timestamps: true,
    underscored: true,
  }
);

ProductGroup.belongsTo(User, { as: 'creator', foreignKey: 'created_by' });

module.exports = ProductGroup;
