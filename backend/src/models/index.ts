import { Sequelize, DataTypes, Model } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT || 3306);
const dbUser = process.env.DB_USER || 'root';
const dbPass = process.env.DB_PASS || '';  // Changed default from 'secret' to ''
const dbName = process.env.DB_NAME || 'rasops_qr';

export const sequelize = new Sequelize(dbName, dbUser, dbPass, {
  host: dbHost,
  port: dbPort,
  dialect: 'mysql',
  logging: false,
});

export class Hotel extends Model {}
export class Table extends Model {}
export class MenuItem extends Model {}
export class Order extends Model {}
export class User extends Model {}

export async function initDb() {
  Hotel.init(
    {
      name: { type: DataTypes.STRING, allowNull: false },
      slug: { type: DataTypes.STRING, allowNull: false },
      address: { type: DataTypes.TEXT },
      location: { type: DataTypes.STRING },
      businessPhone: { type: DataTypes.STRING },
      personalPhone: { type: DataTypes.STRING },
      tablesCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      ownerId: { type: DataTypes.INTEGER, allowNull: true },
    },
    { sequelize, modelName: 'hotel' }
  );

  Table.init(
    {
      hotelId: { type: DataTypes.INTEGER, allowNull: false },
      number: { type: DataTypes.INTEGER, allowNull: false },
      qrPath: { type: DataTypes.STRING },
      status: { type: DataTypes.ENUM('idle', 'new', 'in_progress', 'served'), defaultValue: 'idle' },
      unreadOrders: { type: DataTypes.INTEGER, defaultValue: 0 },
    },
    { sequelize, modelName: 'table' }
  );

  MenuItem.init(
    {
      hotelId: { type: DataTypes.INTEGER, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      category: { type: DataTypes.STRING },
      description: { type: DataTypes.TEXT },
      available: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    { sequelize, modelName: 'menu_item' }
  );

  Order.init(
    {
      hotelId: { type: DataTypes.INTEGER, allowNull: false },
      tableId: { type: DataTypes.INTEGER },
      items: { type: DataTypes.JSON },
      total: { type: DataTypes.DECIMAL(10, 2) },
      status: { type: DataTypes.ENUM('new', 'preparing', 'served', 'cancelled'), defaultValue: 'new' },
      customerInfo: { type: DataTypes.JSON },
    },
    { sequelize, modelName: 'order' }
  );

  User.init(
    {
      name: { type: DataTypes.STRING },
      email: { type: DataTypes.STRING, allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING, allowNull: false },
      role: { type: DataTypes.STRING, defaultValue: 'admin' },
    },
    { 
      sequelize, 
      modelName: 'user',
      tableName: 'users',
      timestamps: false  // Désactivé car la table existe déjà sans ces colonnes
    }
  );

  // Associations
  (Hotel as any).hasMany(Table, { foreignKey: 'hotelId', as: 'tables' });
  (Table as any).belongsTo(Hotel, { foreignKey: 'hotelId' });

  (Hotel as any).hasMany(MenuItem, { foreignKey: 'hotelId', as: 'menu' });
  (MenuItem as any).belongsTo(Hotel, { foreignKey: 'hotelId' });

  (Hotel as any).hasMany(Order, { foreignKey: 'hotelId', as: 'orders' });
  (Order as any).belongsTo(Hotel, { foreignKey: 'hotelId' });

  (Table as any).hasMany(Order, { foreignKey: 'tableId', as: 'orders' });
  (Order as any).belongsTo(Table, { foreignKey: 'tableId' });

  (User as any).hasMany(Hotel, { foreignKey: 'ownerId', as: 'hotels' });
  (Hotel as any).belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

  try {
    await sequelize.sync({ alter: true });
    console.log('Database tables synchronized');
  } catch (err) {
    // don't crash the server if sync fails (DB may already be migrated or permissions differ)
    console.warn('Warning: sequelize.sync() failed, continuing without sync. Error:', err && (err as any).message ? (err as any).message : err);
  }
}

export default sequelize;
