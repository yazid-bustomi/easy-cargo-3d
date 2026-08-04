const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const ContainerType = sequelize.define(
  'ContainerType',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(150),
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
    max_payload_kg: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    tare_weight_kg: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    is_system: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_custom: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
  },
  {
    tableName: 'container_types',
    timestamps: true,
    underscored: true,
  }
);

ContainerType.belongsTo(User, { as: 'creator', foreignKey: 'created_by' });

module.exports = ContainerType;
