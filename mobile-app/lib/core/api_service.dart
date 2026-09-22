import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'constants.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  final String? detail;

  ApiException({required this.statusCode, required this.message, this.detail});

  @override
  String toString() => 'ApiException($statusCode): $message ${detail ?? ""}';
}

class ApiService {
  final String baseUrl;
  final http.Client _client;

  ApiService({String? baseUrl, http.Client? client})
      : baseUrl = baseUrl ?? AppConstants.apiBaseUrl,
        _client = client ?? http.Client();

  Map<String, String> _buildHeaders({String? token, String contentType = 'application/json'}) {
    final headers = <String, String>{
      'Accept': 'application/json',
    };
    if (contentType.isNotEmpty) {
      headers['Content-Type'] = contentType;
    }
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  /// 1. Fetch Authenticated Artisan Profile (GET /artisans/me)
  Future<Map<String, dynamic>> getArtisanProfile({String? token}) async {
    final uri = Uri.parse('$baseUrl/artisans/me');
    try {
      final response = await _client.get(uri, headers: _buildHeaders(token: token));
      if (response.statusCode == 200) {
        return jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      } else {
        throw ApiException(
          statusCode: response.statusCode,
          message: 'Failed to load artisan profile',
          detail: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(statusCode: 0, message: 'Network connection error: $e');
    }
  }

  /// 2. Fetch Authenticated Artisan's Own Products (GET /products/artisan/my)
  Future<List<Map<String, dynamic>>> getArtisanProducts({String? token}) async {
    final uri = Uri.parse('$baseUrl/products/artisan/my');
    try {
      final response = await _client.get(uri, headers: _buildHeaders(token: token));
      if (response.statusCode == 200) {
        final List<dynamic> decoded = jsonDecode(utf8.decode(response.bodyBytes));
        return decoded.map((e) => e as Map<String, dynamic>).toList();
      } else {
        throw ApiException(
          statusCode: response.statusCode,
          message: 'Failed to load artisan products',
          detail: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(statusCode: 0, message: 'Network connection error: $e');
    }
  }

  /// 3. Fetch Incoming Orders for Fulfilling Artisan (GET /orders/artisan)
  Future<List<Map<String, dynamic>>> getArtisanOrders({String? token}) async {
    final uri = Uri.parse('$baseUrl/orders/artisan');
    try {
      final response = await _client.get(uri, headers: _buildHeaders(token: token));
      if (response.statusCode == 200) {
        final List<dynamic> decoded = jsonDecode(utf8.decode(response.bodyBytes));
        return decoded.map((e) => e as Map<String, dynamic>).toList();
      } else {
        throw ApiException(
          statusCode: response.statusCode,
          message: 'Failed to load incoming orders',
          detail: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(statusCode: 0, message: 'Network connection error: $e');
    }
  }

  /// 4. AI Studio Photo Processing Pipeline (POST /products/studio)
  Future<Map<String, dynamic>> uploadStudioPhoto({
    required File imageFile,
    int canvasSize = 1080,
    String? token,
  }) async {
    final uri = Uri.parse('$baseUrl/products/studio');
    try {
      final request = http.MultipartRequest('POST', uri);
      if (token != null && token.isNotEmpty) {
        request.headers['Authorization'] = 'Bearer $token';
      }
      request.fields['canvas_size'] = canvasSize.toString();
      request.files.add(await http.MultipartFile.fromPath(
        'image',
        imageFile.path,
      ));

      final streamedResponse = await _client.send(request);
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        return jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      } else {
        throw ApiException(
          statusCode: response.statusCode,
          message: 'Studio processing failed',
          detail: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(statusCode: 0, message: 'Studio upload error: $e');
    }
  }

  /// 5. Indic Voice-to-Catalog Pipeline (POST /products/voice-catalog)
  Future<Map<String, dynamic>> uploadVoiceCatalog({
    required File audioFile,
    String languageCode = 'hi',
    String? token,
  }) async {
    final uri = Uri.parse('$baseUrl/products/voice-catalog');
    try {
      final request = http.MultipartRequest('POST', uri);
      if (token != null && token.isNotEmpty) {
        request.headers['Authorization'] = 'Bearer $token';
      }
      request.fields['language_code'] = languageCode;
      request.files.add(await http.MultipartFile.fromPath(
        'audio',
        audioFile.path,
      ));

      final streamedResponse = await _client.send(request);
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        return jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      } else {
        throw ApiException(
          statusCode: response.statusCode,
          message: 'Voice cataloging failed',
          detail: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(statusCode: 0, message: 'Voice upload error: $e');
    }
  }

  /// 6. Master AI Orchestration (POST /ai/orchestrate)
  Future<Map<String, dynamic>> orchestrateListing({
    required String rawInput,
    String? imageBase64,
    String region = 'Chhattisgarh',
    String language = 'hi',
    String? token,
  }) async {
    final uri = Uri.parse('$baseUrl/ai/assistant/orchestrate');
    try {
      final body = jsonEncode({
        'raw_input': rawInput,
        'image_base64': imageBase64,
        'region': region,
        'language': language,
      });

      final response = await _client.post(
        uri,
        headers: _buildHeaders(token: token),
        body: body,
      );

      if (response.statusCode == 200) {
        return jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      } else {
        throw ApiException(
          statusCode: response.statusCode,
          message: 'AI Orchestration failed',
          detail: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(statusCode: 0, message: 'AI Orchestration error: $e');
    }
  }

  /// 7. Create Product Listing with Price Floor Guardrail (POST /products)
  Future<Map<String, dynamic>> publishProduct({
    required Map<String, dynamic> productData,
    String? token,
  }) async {
    final uri = Uri.parse('$baseUrl/products');
    try {
      final body = jsonEncode(productData);
      final response = await _client.post(
        uri,
        headers: _buildHeaders(token: token),
        body: body,
      );

      if (response.statusCode == 201) {
        return jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      } else if (response.statusCode == 422) {
        // Price floor violation or validation failure
        throw ApiException(
          statusCode: 422,
          message: 'PRICE_FLOOR_VIOLATION: Price cannot be below statutory minimum cost floor.',
          detail: response.body,
        );
      } else {
        throw ApiException(
          statusCode: response.statusCode,
          message: 'Product creation failed',
          detail: response.body,
        );
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(statusCode: 0, message: 'Product publish error: $e');
    }
  }
}
