import 'package:flutter/foundation.dart';
import 'constants.dart';
import 'api_service.dart';

class AuthState extends ChangeNotifier {
  String _artisanId = AppConstants.defaultArtisanId;
  String _token = AppConstants.defaultDemoToken;
  String _apiBaseUrl = AppConstants.apiBaseUrl;
  Map<String, dynamic>? _artisanProfile;
  bool _isOffline = false;
  String _language = 'hi';

  String get artisanId => _artisanId;
  String get token => _token;
  String get apiBaseUrl => _apiBaseUrl;
  Map<String, dynamic>? get artisanProfile => _artisanProfile;
  bool get isOffline => _isOffline;
  String get language => _language;

  ApiService get apiService => ApiService(baseUrl: _apiBaseUrl);

  void setArtisan({required String id, required String token, Map<String, dynamic>? profile}) {
    _artisanId = id;
    _token = token;
    _artisanProfile = profile;
    notifyListeners();
  }

  void setApiBaseUrl(String url) {
    _apiBaseUrl = url;
    notifyListeners();
  }

  void setOfflineMode(bool offline) {
    _isOffline = offline;
    notifyListeners();
  }

  void setLanguage(String lang) {
    _language = lang;
    notifyListeners();
  }

  void updateProfile(Map<String, dynamic> profile) {
    _artisanProfile = profile;
    notifyListeners();
  }
}
