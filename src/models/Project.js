const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Project = sequelize.define(
  'Project',
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
    // Container config (denormalized from ContainerType)
    container_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: '',
    },
    container_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      defaultValue: '',
    },
    container_length: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    container_width: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    container_height: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    container_max_payload_kg: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    container_tare_weight_kg: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    container_is_system: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // JSON snapshot of the full frontend state
    products_json: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    layout_items_json: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    // Denormalized stats for quick listing
    item_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total_weight_kg: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0,
    },
    volume_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: 'projects',
    timestamps: true,
    underscored: true,
  }
);

module.exports = Project;
