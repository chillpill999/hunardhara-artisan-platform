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
      version: 2,
      onCreate: _createDB,
      onUpgrade: _upgradeDB,
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
        title_hi TEXT,
        craft_type TEXT,
        materials TEXT,
        days_of_labor INTEGER DEFAULT 1,
        estimated_price REAL,
        cost_floor REAL,
        sync_status TEXT DEFAULT 'PENDING',
        created_at TEXT NOT NULL
      )
    ''');

    // Local Cached Products Table (for offline browsing)
    await db.execute('''
      CREATE TABLE cached_products (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        title_hi TEXT,
        craft_type TEXT,
        price REAL NOT NULL,
        stock INTEGER DEFAULT 1,
        image_url TEXT,
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

  Future _upgradeDB(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      await db.execute('''
        CREATE TABLE IF NOT EXISTS cached_products (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          title_hi TEXT,
          craft_type TEXT,
          price REAL NOT NULL,
          stock INTEGER DEFAULT 1,
          image_url TEXT,
          created_at TEXT NOT NULL
        )
      ''');
    }
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

  Future<void> cacheProducts(List<Map<String, dynamic>> products) async {
    final db = await instance.database;
    final batch = db.batch();
    for (final p in products) {
      batch.insert(
        'cached_products',
        {
          'id': p['id']?.toString() ?? '',
          'title': p['title']?.toString() ?? 'Handicraft',
          'title_hi': p['title_hi']?.toString() ?? '',
          'craft_type': p['craft_type']?.toString() ?? '',
          'price': (p['artisan_price'] is num) ? (p['artisan_price'] as num).toDouble() : 0.0,
          'stock': (p['stock'] is int) ? p['stock'] as int : 1,
          'image_url': p['studio_image_url']?.toString() ?? p['raw_photo_url']?.toString() ?? '',
          'created_at': DateTime.now().toIso8601String(),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<List<Map<String, dynamic>>> getCachedProducts() async {
    final db = await instance.database;
    return await db.query('cached_products', orderBy: 'created_at DESC');
  }

  Future<List<Map<String, dynamic>>> getCachedOrders() async {
    final db = await instance.database;
    return await db.query('cached_orders', orderBy: 'created_at DESC');
  }
}
