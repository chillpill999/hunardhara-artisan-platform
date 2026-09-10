import 'dart:async';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class OfflineDatabase {
  static final OfflineDatabase instance = OfflineDatabase._init();
  static Database? _database;

  OfflineDatabase._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('artisan_offline.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(
      path,
      version: 1,
      onCreate: _createDB,
    );
  }

  Future _createDB(Database db, int version) async {
    // Draft Products Table (for offline creation)
    await db.execute('''
      CREATE TABLE draft_products (
        id TEXT PRIMARY KEY,
        local_image_path TEXT NOT NULL,
        local_audio_path TEXT,
        title TEXT,
        materials TEXT,
        estimated_price REAL,
        sync_status TEXT DEFAULT 'PENDING',
        created_at TEXT NOT NULL
      )
    ''');

    // Local Cached Orders Table
    await db.execute('''
      CREATE TABLE cached_orders (
        id TEXT PRIMARY KEY,
        buyer_name TEXT NOT NULL,
        product_title TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        total_amount REAL NOT NULL,
        order_status TEXT DEFAULT 'NEW',
        created_at TEXT NOT NULL
      )
    ''');
  }

  Future<int> insertDraft(Map<String, dynamic> row) async {
    final db = await instance.database;
    return await db.insert('draft_products', row, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<List<Map<String, dynamic>>> getPendingSyncDrafts() async {
    final db = await instance.database;
    return await db.query('draft_products', where: 'sync_status = ?', whereArgs: ['PENDING']);
  }

  Future<int> markDraftSynced(String id) async {
    final db = await instance.database;
    return await db.update(
      'draft_products',
      {'sync_status': 'SYNCED'},
      where: 'id = ?',
      whereArgs: [id],
    );
  }
}
