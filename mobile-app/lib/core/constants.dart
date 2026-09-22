import 'package:flutter/material.dart';

class AppConstants {
  static const String appName = 'Hunardhara';
  static const String appNameHindi = 'हुनरधारा';
  static const String slogan = 'Authentic Indian Crafts & Direct Artisan Linkage';
  static const String sloganHindi = 'भारतीय शिल्प और कारीगरों की सीधी धारा';

  // API Base Configurations
  // Android Emulator default: 10.0.2.2:8000
  // iOS Simulator / Desktop / Web default: 127.0.0.1:8000
  static const String apiBaseUrl = 'http://10.0.2.2:8000/api/v1';
  static const String localHostApiUrl = 'http://127.0.0.1:8000/api/v1';

  // Core Brand Colors
  static const Color primaryTerracotta = Color(0xFF9A3412);
  static const Color primaryOrange = Color(0xFFEA580C);
  static const Color darkStone = Color(0xFF1C1917);
  static const Color warmBackground = Color(0xFFFAF8F5);
  static const Color warmParchment = Color(0xFFF5F2EB);
  static const Color amberGold = Color(0xFFD97706);
  static const Color successGreen = Color(0xFF047857);

  // Default Demo Artisan ID for offline/development mode
  static const String defaultArtisanId = 'artisan-bastar-001';
  static const String defaultDemoToken = 'demo-artisan-bearer-token';
}

class AppColors {
  // Tailored Stone Palette (Material Color equivalents for elegant artisan UI)
  static const Color stone50 = Color(0xFFFAFAF9);
  static const Color stone100 = Color(0xFFF5F5F4);
  static const Color stone200 = Color(0xFFE7E5E4);
  static const Color stone300 = Color(0xFFD6D3D1);
  static const Color stone400 = Color(0xFFA8A29E);
  static const Color stone500 = Color(0xFF78716C);
  static const Color stone600 = Color(0xFF57534E);
  static const Color stone700 = Color(0xFF44403C);
  static const Color stone800 = Color(0xFF292524);
  static const Color stone900 = Color(0xFF1C1917);

  // Status & Feedback colors
  static const Color emerald600 = Color(0xFF059669);
  static const Color emerald50 = Color(0xFFECFDF5);
  static const Color amber50 = Color(0xFFFFFBEB);
  static const Color amber100 = Color(0xFFFEF3C7);
  static const Color red50 = Color(0xFFFEF2F2);
  static const Color red600 = Color(0xFFDC2626);
}
