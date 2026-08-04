const sequelize = require('../config/database');
const User = require('./User');
const ContainerType = require('./ContainerType');
const ProductGroup = require('./ProductGroup');
const Product = require('./Product');
const Layout = require('./Layout');
const LayoutItem = require('./LayoutItem');

// Define associations
User.hasMany(ContainerType, { as: 'containerTypes', foreignKey: 'created_by' });
User.hasMany(ProductGroup, { as: 'productGroups', foreignKey: 'created_by' });
User.hasMany(Product, { as: 'products', foreignKey: 'created_by' });
User.hasMany(Layout, { as: 'layouts', foreignKey: 'created_by' });

ContainerType.hasMany(Layout, { as: 'layouts', foreignKey: 'container_type_id' });

ProductGroup.hasMany(Product, { as: 'products', foreignKey: 'group_id' });

Product.hasMany(LayoutItem, { as: 'layoutItems', foreignKey: 'product_id' });

Layout.hasMany(LayoutItem, { as: 'items', foreignKey: 'layout_id', cascade: true });

module.exports = {
  sequelize,
  User,
  ContainerType,
  ProductGroup,
  Product,
  Layout,
  LayoutItem,
};
