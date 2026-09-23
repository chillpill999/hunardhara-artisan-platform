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

  Map<String, String> _buildSupabaseHeaders({String? token, String contentType = 'application/json'}) {
    final effectiveToken = (token != null && token.isNotEmpty && token != AppConstants.defaultDemoToken)
        ? token
        : AppConstants.supabaseAnonKey;
    final headers = <String, String>{
      'apikey': AppConstants.supabaseAnonKey,
      'Authorization': 'Bearer $effectiveToken',
      'Accept': 'application/json',
    };
    if (contentType.isNotEmpty) {
      headers['Content-Type'] = contentType;
    }
    return headers;
  }

  /// 1. Fetch Authenticated Artisan Profile (GET /artisans/me or Supabase REST)
  Future<Map<String, dynamic>> getArtisanProfile({String? token}) async {
    // 1. Direct Supabase Query (Single Source of Truth)
    try {
      final supaUri = Uri.parse('${AppConstants.supabaseRestUrl}/artisans?select=*,craft_clusters(name,state,district)&order=created_at.desc&limit=1');
      final supaRes = await _client.get(supaUri, headers: _buildSupabaseHeaders(token: token));
      if (supaRes.statusCode == 200) {
        final List<dynamic> list = jsonDecode(utf8.decode(supaRes.bodyBytes));
        if (list.isNotEmpty) {
          final row = list.first as Map<String, dynamic>;
          final cluster = row['craft_clusters'] is Map ? row['craft_clusters'] as Map<String, dynamic> : null;
          return <String, dynamic>{
            'id': row['id'],
            'full_name': row['full_name'] ?? 'Verified Artisan',
            'business_name': row['full_name'] ?? 'Artisan Workshop',
            'craft_type': row['primary_craft'] ?? row['craft'] ?? 'Handicrafts',
            'production_capacity_monthly': row['monthly_capacity_units'] ?? 30,
            'is_verified': row['is_verified'] ?? true,
            'state': row['state'] ?? cluster?['state'] ?? 'India',
            'district': row['district'] ?? cluster?['district'] ?? '',
            'cluster_name': row['cluster_name'] ?? cluster?['name'] ?? 'Craft Cluster',
            'phone_number': row['phone_number'] ?? '',
          };
        }
      }
    } catch (_) {
      // Fallback to backend API
    }

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

  /// 2. Fetch Authenticated Artisan's Own Products (GET /products/artisan/my or Supabase REST)
  Future<List<Map<String, dynamic>>> getArtisanProducts({String? token}) async {
    // 1. Direct Supabase Query (Single Source of Truth)
    try {
      final supaUri = Uri.parse('${AppConstants.supabaseRestUrl}/products?select=*&is_active=eq.true&order=created_at.desc');
      final supaRes = await _client.get(supaUri, headers: _buildSupabaseHeaders(token: token));
      if (supaRes.statusCode == 200) {
        final List<dynamic> list = jsonDecode(utf8.decode(supaRes.bodyBytes));
        return list.map((e) {
          final p = e as Map<String, dynamic>;
          return <String, dynamic>{
            'id': p['id'],
            'title': p['title'],
            'title_en': p['title'],
            'title_hi': p['description_hindi'] ?? p['title'],
            'craft_type': p['craft_type'] ?? 'Handicrafts',
            'materials': p['materials'] is List ? (p['materials'] as List).join(', ') : (p['materials']?.toString() ?? ''),
            'artisan_price': (p['listing_price'] is num) ? (p['listing_price'] as num).toDouble() : 0.0,
            'cost_floor': (p['floor_price'] is num) ? (p['floor_price'] as num).toDouble() : 0.0,
            'suggested_retail_max': (p['recommended_retail_price'] is num) ? (p['recommended_retail_price'] as num).toDouble() : (p['listing_price'] ?? 0.0),
            'suggested_wholesale': (p['wholesale_b2b_price'] is num) ? (p['wholesale_b2b_price'] as num).toDouble() : 0.0,
            'stock': p['stock_quantity'] ?? 1,
            'studio_image_url': p['studio_image_url'] ?? '',
            'created_at': p['created_at'],
          };
        }).toList();
      }
    } catch (_) {
      // Fallback to backend API
    }

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

  /// 3. Fetch Incoming Orders for Fulfilling Artisan (GET /orders/artisan or Supabase REST)
  Future<List<Map<String, dynamic>>> getArtisanOrders({String? token}) async {
    // 1. Direct Supabase Query (Single Source of Truth)
    try {
      final supaUri = Uri.parse('${AppConstants.supabaseRestUrl}/orders?select=*&order=created_at.desc');
      final supaRes = await _client.get(supaUri, headers: _buildSupabaseHeaders(token: token));
      if (supaRes.statusCode == 200) {
        final List<dynamic> list = jsonDecode(utf8.decode(supaRes.bodyBytes));
        return list.map((e) {
          final o = e as Map<String, dynamic>;
          return <String, dynamic>{
            'id': o['id'],
            'order_number': o['order_number'] ?? o['id'],
            'product_id': o['product_id'],
            'product_title': o['product_title'] ?? 'Handicraft Item',
            'quantity': o['quantity'] ?? 1,
            'total_amount': (o['total_price'] is num) ? (o['total_price'] as num).toDouble() : 0.0,
            'status': o['status'] ?? 'CONFIRMED',
            'payment_status': o['payment_status'] ?? 'PAID',
            'created_at': o['created_at'],
          };
        }).toList();
      }
    } catch (_) {
      // Fallback to backend API
    }

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

  /// 5. Indic Voice-to-Catalog Pipeline (Edge Function or POST /products/voice-catalog)
  Future<Map<String, dynamic>> uploadVoiceCatalog({
    required File audioFile,
    String languageCode = 'hi',
    String? token,
  }) async {
    // 1. Direct Supabase Edge Function (Single Source of Truth)
    try {
      final supaUri = Uri.parse('${AppConstants.supabaseFunctionsUrl}/voice-catalog');
      final audioBytes = await audioFile.readAsBytes();
      final audioBase64 = base64Encode(audioBytes);
      final supaRes = await _client.post(
        supaUri,
        headers: _buildSupabaseHeaders(token: token),
        body: jsonEncode({
          'action': 'speak-to-catalog',
          'audio_base64': audioBase64,
          'language': languageCode,
        }),
      );
      if (supaRes.statusCode == 200) {
        final resData = jsonDecode(utf8.decode(supaRes.bodyBytes)) as Map<String, dynamic>;
        final extracted = (resData['extracted'] is Map)
            ? resData['extracted'] as Map<String, dynamic>
            : (resData['catalog'] is Map ? resData['catalog'] as Map<String, dynamic> : resData);
        final pricing = (extracted['pricing'] is Map) ? extracted['pricing'] as Map<String, dynamic> : extracted;

        return <String, dynamic>{
          'title': extracted['title'] ?? extracted['title_en'] ?? 'Handcrafted Art',
          'title_en': extracted['title_en'] ?? extracted['title'] ?? 'Handcrafted Art',
          'title_hi': extracted['title_hi'] ?? 'हस्तनिर्मित शिल्प',
          'craft_type': extracted['craft_type'] ?? 'Handicrafts',
          'materials': extracted['materials'] ?? 'Traditional Natural Materials',
          'production_days': extracted['production_days'] ?? 2,
          'transcription': resData['transcription'] ?? resData['transcription_regional'] ?? '',
          'pricing': <String, dynamic>{
            'cost_estimate': pricing['floor_price'] ?? pricing['cost_floor'] ?? pricing['cost_estimate'] ?? 1000.0,
            'cost_floor': pricing['floor_price'] ?? pricing['cost_floor'] ?? 1000.0,
            'floor_price': pricing['floor_price'] ?? 1000.0,
            'recommended_price': pricing['recommended_price'] ?? pricing['suggested_retail_max'] ?? 1500.0,
            'suggested_retail_max': pricing['recommended_price'] ?? pricing['suggested_retail_max'] ?? 1500.0,
            'wholesale_price': pricing['wholesale_price'] ?? pricing['suggested_wholesale'] ?? 1200.0,
            'suggested_wholesale': pricing['wholesale_price'] ?? pricing['suggested_wholesale'] ?? 1200.0,
          },
        };
      }
    } catch (_) {
      // Fallback to backend API
    }

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

  /// 6. Master AI Orchestration (POST /ai/orchestrate or Edge Function)
  Future<Map<String, dynamic>> orchestrateListing({
    required String rawInput,
    String? imageBase64,
    String region = 'Chhattisgarh',
    String language = 'hi',
    String? token,
  }) async {
    // 1. Direct Supabase Edge Function (Single Source of Truth)
    try {
      final supaUri = Uri.parse('${AppConstants.supabaseFunctionsUrl}/ai-catalog');
      final supaRes = await _client.post(
        supaUri,
        headers: _buildSupabaseHeaders(token: token),
        body: jsonEncode({
          'action': 'extract_attributes',
          'transcript': rawInput,
          'region': region,
          'language': language,
        }),
      );
      if (supaRes.statusCode == 200) {
        return jsonDecode(utf8.decode(supaRes.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (_) {
      // Fallback to backend API
    }

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

  /// 7. Create Product Listing with Price Floor Guardrail (POST /products or Supabase REST)
  Future<Map<String, dynamic>> publishProduct({
    required Map<String, dynamic> productData,
    String? token,
  }) async {
    final floorPrice = (productData['cost_floor'] is num)
        ? (productData['cost_floor'] as num).toDouble()
        : 0.0;
    final listingPrice = (productData['artisan_price'] is num)
        ? (productData['artisan_price'] as num).toDouble()
        : floorPrice;

    // Enforce Price floor guardrail before submission
    if (floorPrice > 0 && listingPrice < floorPrice) {
      throw ApiException(
        statusCode: 422,
        message: 'PRICE_FLOOR_VIOLATION: Price cannot be below statutory minimum cost floor.',
      );
    }

    // 1. Direct Supabase REST Insertion (Single Source of Truth)
    try {
      final supaUri = Uri.parse('${AppConstants.supabaseRestUrl}/products');
      final productId = 'prod-mob-${DateTime.now().millisecondsSinceEpoch}';
      final payload = <String, dynamic>{
        'id': productId,
        'artisan_id': (productData['artisan_id'] ?? '11111111-1111-1111-1111-111111111111').toString(),
        'title': productData['title'] ?? 'Handcrafted Handicraft',
        'craft_type': productData['craft_type'] ?? 'Handicrafts',
        'materials': productData['materials'] ?? [],
        'cost_materials': productData['cost_materials'] ?? (floorPrice * 0.4),
        'floor_price': floorPrice,
        'listing_price': listingPrice,
        'recommended_retail_price': productData['suggested_retail_max'] ?? (floorPrice * 1.5),
        'wholesale_b2b_price': productData['suggested_wholesale'] ?? (floorPrice * 1.1),
        'stock_quantity': productData['stock'] ?? 1,
        'is_active': true,
        'studio_image_url': productData['studio_image_url'] ?? '',
        'before_after_preview_url': productData['before_after_preview_url'] ?? '',
        'description_hindi': productData['title_hi'] ?? '',
        'description_english': productData['long_description'] ?? productData['short_description'] ?? '',
        'created_at': DateTime.now().toIso8601String(),
      };

      final supaRes = await _client.post(
        supaUri,
        headers: _buildSupabaseHeaders(token: token),
        body: jsonEncode(payload),
      );

      if (supaRes.statusCode == 201 || supaRes.statusCode == 200) {
        return payload;
      }
    } catch (_) {
      // Fallback to backend API
    }

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
