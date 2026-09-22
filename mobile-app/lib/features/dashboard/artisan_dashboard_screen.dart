import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/api_service.dart';
import '../../core/offline_database.dart';
import '../camera/camera_studio_screen.dart';

class ArtisanDashboardScreen extends StatefulWidget {
  const ArtisanDashboardScreen({Key? key}) : super(key: key);

  @override
  State<ArtisanDashboardScreen> createState() => _ArtisanDashboardScreenState();
}

class _ArtisanDashboardScreenState extends State<ArtisanDashboardScreen> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  bool _isOffline = false;
  String? _errorMessage;

  // Real-time Dynamic Metrics
  String _artisanName = 'कारीगर (Artisan)';
  String _clusterName = 'शिल्प क्लस्टर (Craft Cluster)';
  String _verificationBadge = 'Pending Auth';
  double _totalRevenue = 0.0;
  int _activeListingsCount = 0;
  int _ordersReceivedCount = 0;
  int _monthlyCapacity = 0;
  List<Map<String, dynamic>> _products = [];

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // 1. Fetch Profile, Products, and Orders concurrently
      final profileFuture = _apiService.getArtisanProfile(token: AppConstants.defaultDemoToken);
      final productsFuture = _apiService.getArtisanProducts(token: AppConstants.defaultDemoToken);
      final ordersFuture = _apiService.getArtisanOrders(token: AppConstants.defaultDemoToken);

      final results = await Future.wait([
        profileFuture.catchError((e) => <String, dynamic>{}),
        productsFuture.catchError((e) => <Map<String, dynamic>>[]),
        ordersFuture.catchError((e) => <Map<String, dynamic>>[]),
      ]);

      final profile = results[0] as Map<String, dynamic>;
      final products = results[1] as List<Map<String, dynamic>>;
      final orders = results[2] as List<Map<String, dynamic>>;

      // Parse Profile
      if (profile.isNotEmpty) {
        _artisanName = profile['business_name']?.toString() ?? profile['full_name']?.toString() ?? profile['craft_type']?.toString() ?? _artisanName;
        _clusterName = profile['craft_type'] != null ? '${profile['craft_type']} Cluster' : _clusterName;
        _monthlyCapacity = (profile['production_capacity_monthly'] is int)
            ? profile['production_capacity_monthly'] as int
            : _monthlyCapacity;
        _verificationBadge = (profile['is_verified'] == true) ? 'MoSJE Verified' : 'Registered Member';
      } else {
        _verificationBadge = 'Unauthenticated';
      }

      if (profile.isEmpty && products.isEmpty && orders.isEmpty) {
        _errorMessage = 'Live dashboard data unavailable. Connect to backend.';
      }

      // Parse Products
      _products = products;
      _activeListingsCount = products.length;

      // Cache products locally in SQLite for offline resilience
      if (products.isNotEmpty) {
        await OfflineDatabase.instance.cacheProducts(products);
      }

      // Parse Orders & Calculate Real Direct Revenue
      _ordersReceivedCount = orders.length;
      double calculatedRevenue = 0.0;
      for (final order in orders) {
        final amt = order['total_amount'];
        if (amt is num) {
          calculatedRevenue += amt.toDouble();
        }
      }
      _totalRevenue = calculatedRevenue;

      setState(() {
        _isLoading = false;
        _isOffline = false;
      });
    } catch (e) {
      // Fall back to offline SQLite cache
      final cached = await OfflineDatabase.instance.getCachedProducts();
      final cachedOrders = await OfflineDatabase.instance.getCachedOrders();

      double offlineRevenue = 0.0;
      for (final ord in cachedOrders) {
        final amt = ord['total_amount'];
        if (amt is num) offlineRevenue += amt.toDouble();
      }

      setState(() {
        _isOffline = true;
        _isLoading = false;
        _products = cached;
        _activeListingsCount = cached.length;
        _ordersReceivedCount = cachedOrders.length;
        _totalRevenue = offlineRevenue;
        _errorMessage = 'Offline Mode: Connected to local cache.';
      });
    }
  }

  void _showSettingsDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('API & Cluster Settings / सेटिंग्स', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Backend Host:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
            const SizedBox(height: 4),
            Text(AppConstants.apiBaseUrl, style: const TextStyle(fontSize: 11, color: AppColors.stone600)),
            const SizedBox(height: 12),
            const Text('Active Artisan Identity:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
            const SizedBox(height: 4),
            Text(AppConstants.defaultArtisanId, style: const TextStyle(fontSize: 11, color: AppColors.stone600)),
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(_isOffline ? Icons.cloud_off : Icons.cloud_done,
                    color: _isOffline ? Colors.orange : AppConstants.successGreen, size: 16),
                const SizedBox(width: 6),
                Text(_isOffline ? 'Offline Cache Active' : 'Live Cloud Connected',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: _isOffline ? Colors.orange : AppConstants.successGreen)),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _loadDashboardData();
            },
            child: const Text('Refresh / रिफ्रेश', style: TextStyle(color: AppConstants.primaryOrange, fontWeight: FontWeight.bold)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppConstants.primaryOrange,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(context),
            child: const Text('Done', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppConstants.warmBackground,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '$_artisanName / कारीगर',
              style: const TextStyle(color: AppConstants.darkStone, fontWeight: FontWeight.bold, fontSize: 16),
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              '$_clusterName • $_verificationBadge',
              style: const TextStyle(color: AppColors.stone500, fontSize: 11),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: AppConstants.darkStone),
            onPressed: _showSettingsDialog,
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: AppConstants.darkStone),
            onPressed: _loadDashboardData,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadDashboardData,
        color: AppConstants.primaryOrange,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Error Banner with Retry
              if (_errorMessage != null && !_isOffline)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.red50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, size: 18, color: AppColors.red600),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(fontSize: 11, color: AppColors.red600, fontWeight: FontWeight.w500),
                        ),
                      ),
                      TextButton(
                        onPressed: _loadDashboardData,
                        child: const Text('पुनः प्रयास (Retry)', style: TextStyle(fontSize: 11, color: AppColors.red600, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ),

              // Offline Banner
              if (_isOffline)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.amber50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.amber.shade300),
                  ),
                  child: Row(
                    children: const [
                      Icon(Icons.wifi_off, size: 16, color: AppConstants.amberGold),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Offline Mode: Displaying locally cached crafts and orders. Sync resumes automatically.',
                          style: TextStyle(fontSize: 11, color: AppConstants.darkStone, fontWeight: FontWeight.w500),
                        ),
                      ),
                    ],
                  ),
                ),

              // Revenue & Metrics Hero
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF7C2D12), Color(0xFFC2410C)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(color: Colors.orange.shade900.withOpacity(0.25), blurRadius: 15, offset: const Offset(0, 6)),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Total Direct Revenue / कुल कमाई', style: TextStyle(color: Colors.white70, fontSize: 12)),
                    const SizedBox(height: 4),
                    Text(
                      '₹${_totalRevenue.toInt().toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
                      style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 14),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _buildWhiteMetric('$_activeListingsCount', 'Active Listings'),
                        _buildWhiteMetric('$_ordersReceivedCount', 'Orders Received'),
                        _buildWhiteMetric('₹650/day', 'Min Wage Floor'),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Capacity & B2B Matchmaking Banner
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.amber50,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.amber.shade300),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.inventory_2_outlined, color: AppConstants.amberGold, size: 24),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Monthly Capacity: $_monthlyCapacity units',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppConstants.darkStone)),
                          Text('B2B matchmaking will pool SHG cluster partners for orders above $_monthlyCapacity units.',
                              style: const TextStyle(fontSize: 11, color: Colors.black87)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Section Header: My Products
              Row(
                mainAxisAlignment: MainAxisAlignment.between,
                children: [
                  const Text('My Digital Catalog / मेरी वस्तुएं',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppConstants.darkStone)),
                  Text('${_products.length} Items',
                      style: const TextStyle(color: AppConstants.primaryOrange, fontWeight: FontWeight.bold, fontSize: 12)),
                ],
              ),
              const SizedBox(height: 14),

              // Dynamic Products List
              if (_isLoading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(40),
                    child: CircularProgressIndicator(color: AppConstants.primaryOrange),
                  ),
                )
              else if (_products.isEmpty)
                Container(
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.stone200),
                  ),
                  child: Center(
                    child: Column(
                      children: const [
                        Icon(Icons.inventory_2_outlined, size: 48, color: AppColors.stone400),
                        SizedBox(height: 12),
                        Text('No products listed yet / कोई वस्तु नहीं है',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppConstants.darkStone)),
                        SizedBox(height: 4),
                        Text('Tap "New Craft" below to snap, speak and list your craft in 60 seconds.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12, color: AppColors.stone500)),
                      ],
                    ),
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _products.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final item = _products[index];
                    final title = item['title']?.toString() ?? 'Handicraft Item';
                    final stock = (item['stock'] is int) ? item['stock'] as int : 1;
                    final price = (item['artisan_price'] is num)
                        ? item['artisan_price'] as num
                        : (item['price'] is num ? item['price'] as num : 0);
                    final stockText = stock <= 4 ? '$stock units left (Low Stock)' : '$stock units in stock';
                    final stockColor = stock <= 4 ? Colors.amber.shade800 : Colors.green.shade700;

                    return _buildProductRow(
                      title: title,
                      stock: stockText,
                      price: '₹${price.toInt()}',
                      statusColor: stockColor,
                    );
                  },
                ),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppConstants.primaryOrange,
        icon: const Icon(Icons.camera_alt, color: Colors.white),
        label: const Text('New Craft / नई वस्तु', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: () async {
          final result = await Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const CameraStudioScreen()),
          );
          if (result == true) {
            _loadDashboardData();
          }
        },
      ),
    );
  }

  static Widget _buildWhiteMetric(String value, String label) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
        Text(label, style: const TextStyle(color: Colors.white60, fontSize: 10)),
      ],
    );
  }

  static Widget _buildProductRow({
    required String title,
    required String stock,
    required String price,
    required Color statusColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: Colors.orange.shade50, borderRadius: BorderRadius.circular(12)),
            child: const Center(child: Icon(Icons.brush, color: AppConstants.primaryOrange, size: 22)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppConstants.darkStone)),
                const SizedBox(height: 2),
                Text(stock, style: TextStyle(fontSize: 11, color: statusColor, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          Text(price, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppConstants.darkStone)),
        ],
      ),
    );
  }
}
