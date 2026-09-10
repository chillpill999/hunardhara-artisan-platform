import 'package:flutter/material.dart';
import 'core/constants.dart';
import 'features/dashboard/artisan_dashboard_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const HunardharaArtisanApp());
}

class HunardharaArtisanApp extends StatelessWidget {
  const HunardharaArtisanApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Hunardhara (हुनरधारा)',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        scaffoldBackgroundColor: AppConstants.warmBackground,
        primaryColor: AppConstants.primaryTerracotta,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppConstants.primaryTerracotta,
          primary: AppConstants.primaryTerracotta,
        ),
        fontFamily: 'Roboto',
      ),
      home: const ArtisanDashboardScreen(),
    );
  }
}
