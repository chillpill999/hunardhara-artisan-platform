import 'dart:io';
import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/api_service.dart';
import '../../core/offline_database.dart';
import '../dashboard/artisan_dashboard_screen.dart';

class ReviewCatalogScreen extends StatefulWidget {
  final File rawPhotoFile;
  final String studioImageUrl;
  final String beforeAfterPreviewUrl;
  final String titleEn;
  final String titleHi;
  final String craftType;
  final String materials;
  final int daysOfLabor;
  final double floorPrice;
  final double recommendedRetailPrice;
  final double wholesalePrice;
  final String shortDescription;
  final String longDescription;

  const ReviewCatalogScreen({
    Key? key,
    required this.rawPhotoFile,
    required this.studioImageUrl,
    required this.beforeAfterPreviewUrl,
    required this.titleEn,
    required this.titleHi,
    required this.craftType,
    required this.materials,
    required this.daysOfLabor,
    required this.floorPrice,
    required this.recommendedRetailPrice,
    required this.wholesalePrice,
    this.shortDescription = '',
    this.longDescription = '',
  }) : super(key: key);

  @override
  State<ReviewCatalogScreen> createState() => _ReviewCatalogScreenState();
}

class _ReviewCatalogScreenState extends State<ReviewCatalogScreen> {
  final ApiService _apiService = ApiService();
  bool _showOriginal = false;
  late double _selectedPrice;
  late TextEditingController _titleController;
  bool _isPublishing = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _selectedPrice = widget.recommendedRetailPrice >= widget.floorPrice
        ? widget.recommendedRetailPrice
        : widget.floorPrice;
    _titleController = TextEditingController(text: widget.titleEn);
  }

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  Future<void> _publishProduct() async {
    setState(() {
      _isPublishing = true;
      _errorMessage = null;
    });

    // Client-side guardrail check against MoSJE statutory price floor
    if (_selectedPrice < widget.floorPrice) {
      setState(() {
        _isPublishing = false;
        _errorMessage = 'Price cannot be below statutory cost floor of ₹${widget.floorPrice.toInt()}';
      });
      return;
    }

    final productPayload = <String, dynamic>{
      'title': _titleController.text.isNotEmpty ? _titleController.text : widget.titleEn,
      'title_hi': widget.titleHi,
      'short_description': widget.shortDescription.isNotEmpty
          ? widget.shortDescription
          : 'Handcrafted ${widget.craftType} creation by skilled artisan.',
      'long_description': widget.longDescription.isNotEmpty
          ? widget.longDescription
          : 'Authentic ${widget.craftType} made with ${widget.materials}.',
      'craft_type': widget.craftType,
      'materials': widget.materials.split(',').map((m) => m.trim()).toList(),
      'production_days': widget.daysOfLabor,
      'artisan_price': _selectedPrice,
      'cost_floor': widget.floorPrice,
      'suggested_retail_min': widget.floorPrice * 1.25,
      'suggested_retail_max': widget.recommendedRetailPrice,
      'suggested_wholesale': widget.wholesalePrice,
      'stock': 1,
    };

    if (widget.studioImageUrl.isNotEmpty) {
      productPayload['studio_image_url'] = widget.studioImageUrl;
    }
    if (widget.beforeAfterPreviewUrl.isNotEmpty) {
      productPayload['before_after_preview_url'] = widget.beforeAfterPreviewUrl;
    }

    try {
      await _apiService.publishProduct(
        productData: productPayload,
        token: AppConstants.defaultDemoToken,
      );

      setState(() => _isPublishing = false);

      if (!mounted) return;
      _showSuccessDialog();
    } catch (e) {
      setState(() => _isPublishing = false);

      if (e is ApiException && e.statusCode == 422) {
        setState(() {
          _errorMessage = 'Price floor guardrail: Cannot publish below ₹${widget.floorPrice.toInt()}';
        });
      } else {
        // Offer offline draft save
        _showOfflineSaveOption(productPayload);
      }
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Row(
          children: const [
            Icon(Icons.check_circle, color: AppConstants.successGreen, size: 28),
            SizedBox(width: 8),
            Text('Published! / प्रकाशित!'),
          ],
        ),
        content: const Text(
          'Your handicraft has been cataloged and published to the HunarDhara Marketplace (ONDC Beckn Protocol schema compatible).',
          style: TextStyle(fontSize: 13, height: 1.4),
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppConstants.primaryOrange,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () {
              Navigator.pop(context); // Close dialog
              Navigator.pushAndRemoveUntil(
                context,
                MaterialPageRoute(builder: (context) => const ArtisanDashboardScreen()),
                (route) => false,
              );
            },
            child: const Text('Go to Dashboard / डैशबोर्ड पर जाएं', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showOfflineSaveOption(Map<String, dynamic> payload) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Row(
          children: const [
            Icon(Icons.cloud_off, color: AppConstants.amberGold, size: 24),
            SizedBox(width: 8),
            Text('Offline Draft / ऑफ़लाइन ड्राफ्ट'),
          ],
        ),
        content: const Text(
          'Network connection unavailable. Would you like to save this product as an offline draft? It will automatically sync when connectivity returns.',
          style: TextStyle(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppConstants.primaryOrange,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () async {
              await OfflineDatabase.instance.insertDraft({
                'id': 'draft_${DateTime.now().millisecondsSinceEpoch}',
                'local_image_path': widget.rawPhotoFile.path,
                'title': payload['title'],
                'title_hi': payload['title_hi'],
                'craft_type': payload['craft_type'],
                'materials': widget.materials,
                'days_of_labor': widget.daysOfLabor,
                'estimated_price': _selectedPrice,
                'cost_floor': widget.floorPrice,
                'sync_status': 'PENDING',
                'created_at': DateTime.now().toIso8601String(),
              });
              if (!mounted) return;
              Navigator.pop(context);
              Navigator.pushAndRemoveUntil(
                context,
                MaterialPageRoute(builder: (context) => const ArtisanDashboardScreen()),
                (route) => false,
              );
            },
            child: const Text('Save Draft / ड्राफ्ट सहेजें', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasStudioUrl = widget.studioImageUrl.isNotEmpty;

    return Scaffold(
      backgroundColor: AppConstants.warmBackground,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppConstants.darkStone),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Step 3: Review & Sell / समीक्षा व बिक्री',
          style: TextStyle(color: AppConstants.darkStone, fontWeight: FontWeight.bold, fontSize: 16),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Error Alert Banner
            if (_errorMessage != null)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.red50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.red.shade300),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: AppColors.red600, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(color: AppColors.red600, fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),

            // Before vs After Studio Card
            Container(
              height: 240,
              width: double.infinity,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                color: Colors.white,
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10, offset: const Offset(0, 4)),
                ],
              ),
              child: Stack(
                children: [
                  Center(
                    child: _showOriginal || !hasStudioUrl
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(24),
                            child: Image.file(
                              widget.rawPhotoFile,
                              fit: BoxFit.cover,
                              width: double.infinity,
                              height: 240,
                            ),
                          )
                        : ClipRRect(
                            borderRadius: BorderRadius.circular(24),
                            child: Image.network(
                              widget.studioImageUrl.startsWith('http')
                                  ? widget.studioImageUrl
                                  : '${AppConstants.apiBaseUrl.replaceAll("/api/v1", "")}${widget.studioImageUrl}',
                              fit: BoxFit.cover,
                              width: double.infinity,
                              height: 240,
                              errorBuilder: (context, error, stackTrace) => Image.file(
                                widget.rawPhotoFile,
                                fit: BoxFit.cover,
                                width: double.infinity,
                                height: 240,
                              ),
                            ),
                          ),
                  ),

                  // Switcher pill
                  Positioned(
                    bottom: 12,
                    right: 12,
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.black87,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          GestureDetector(
                            onTap: () => setState(() => _showOriginal = false),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: !_showOriginal ? AppConstants.primaryOrange : Colors.transparent,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: const Text('AI Studio 1:1',
                                  style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                            ),
                          ),
                          GestureDetector(
                            onTap: () => setState(() => _showOriginal = true),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: _showOriginal ? Colors.white24 : Colors.transparent,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: const Text('Original Raw',
                                  style: TextStyle(color: Colors.white70, fontSize: 11)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // AI Generated Bilingual Title & Chip Attributes
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.stone200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: Colors.orange.shade50, borderRadius: BorderRadius.circular(8)),
                        child: const Text('AUTO-GENERATED CATALOG',
                            style: TextStyle(color: AppConstants.primaryOrange, fontSize: 9, fontWeight: FontWeight.bold)),
                      ),
                      IconButton(
                        icon: const Icon(Icons.volume_up, color: AppConstants.amberGold, size: 20),
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Playing Indic Voice Preview: ${widget.titleHi}')),
                          );
                        },
                      ),
                    ],
                  ),
                  TextField(
                    controller: _titleController,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppConstants.darkStone),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      hintText: 'Product Title',
                    ),
                  ),
                  Text(widget.titleHi,
                      style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13, color: AppColors.stone500)),
                  const SizedBox(height: 12),

                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      _buildChip(Icons.brush, widget.craftType),
                      _buildChip(Icons.construction, widget.materials),
                      _buildChip(Icons.timer, '${widget.daysOfLabor} Days Labor'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Smart Pricing Section with statutory wage protection
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.amber50.withOpacity(0.6),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.amber.shade300),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Smart Pricing Assistant',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppConstants.darkStone),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: Colors.green.shade100, borderRadius: BorderRadius.circular(8)),
                        child: const Text('FAIR WAGE PROTECTED',
                            style: TextStyle(color: Colors.green, fontSize: 9, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildPriceBadge('Cost-Plus Floor', '₹${widget.floorPrice.toInt()}', AppColors.stone500),
                      _buildPriceBadge('Recommended Retail', '₹${widget.recommendedRetailPrice.toInt()}', AppConstants.primaryOrange),
                      _buildPriceBadge('Wholesale B2B', '₹${widget.wholesalePrice.toInt()}', Colors.blue.shade700),
                    ],
                  ),
                  const SizedBox(height: 14),

                  Text(
                    'Your Selling Price: ₹${_selectedPrice.toInt()}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppConstants.darkStone),
                  ),
                  Slider(
                    value: _selectedPrice.clamp(widget.floorPrice, 10000.0),
                    min: widget.floorPrice,
                    max: (widget.recommendedRetailPrice * 1.6).clamp(widget.floorPrice + 500, 15000.0),
                    divisions: 30,
                    activeColor: AppConstants.primaryOrange,
                    inactiveColor: AppColors.stone300,
                    onChanged: (val) {
                      setState(() {
                        _selectedPrice = val;
                        _errorMessage = null;
                      });
                    },
                  ),
                  Text(
                    'Minimum floor price guaranteed at ₹${widget.floorPrice.toInt()} based on ${widget.daysOfLabor} days of labor under statutory daily wage rates.',
                    style: const TextStyle(fontSize: 10, color: AppColors.stone600),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // One-Tap Publish Button
            SizedBox(
              width: double.infinity,
              height: 54,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppConstants.primaryOrange,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 2,
                ),
                onPressed: _isPublishing ? null : _publishProduct,
                child: _isPublishing
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: const [
                          Icon(Icons.cloud_upload, color: Colors.white, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Publish Product / प्रकाशित करें',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                        ],
                      ),
              ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  Widget _buildChip(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: AppColors.stone100, borderRadius: BorderRadius.circular(8)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AppConstants.darkStone),
          const SizedBox(width: 4),
          Text(text, style: const TextStyle(fontSize: 11, color: AppConstants.darkStone, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildPriceBadge(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 10, color: AppColors.stone500)),
        const SizedBox(height: 2),
        Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: color)),
      ],
    );
  }
}
