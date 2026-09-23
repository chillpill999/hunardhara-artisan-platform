export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string
          created_at: string | null
          details: string | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id: string
          created_at?: string | null
          details?: string | null
          id: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string
          created_at?: string | null
          details?: string | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      AiChatMessage: {
        Row: {
          confidence: number | null
          content: string
          createdAt: string
          id: string
          intent: string | null
          role: string
          sessionId: string
          tokens: number | null
          userId: string | null
        }
        Insert: {
          confidence?: number | null
          content: string
          createdAt?: string
          id: string
          intent?: string | null
          role: string
          sessionId: string
          tokens?: number | null
          userId?: string | null
        }
        Update: {
          confidence?: number | null
          content?: string
          createdAt?: string
          id?: string
          intent?: string | null
          role?: string
          sessionId?: string
          tokens?: number | null
          userId?: string | null
        }
        Relationships: []
      }
      Announcement: {
        Row: {
          authorId: string
          category: Database["public"]["Enums"]["AnnouncementCategory"]
          content: string
          createdAt: string
          eventId: string | null
          id: string
          isActive: boolean
          isPinned: boolean
          priority: Database["public"]["Enums"]["AnnouncementPriority"]
          publishedAt: string
          targetRole: Database["public"]["Enums"]["Role"] | null
          title: string
          updatedAt: string
        }
        Insert: {
          authorId: string
          category?: Database["public"]["Enums"]["AnnouncementCategory"]
          content: string
          createdAt?: string
          eventId?: string | null
          id: string
          isActive?: boolean
          isPinned?: boolean
          priority?: Database["public"]["Enums"]["AnnouncementPriority"]
          publishedAt?: string
          targetRole?: Database["public"]["Enums"]["Role"] | null
          title: string
          updatedAt: string
        }
        Update: {
          authorId?: string
          category?: Database["public"]["Enums"]["AnnouncementCategory"]
          content?: string
          createdAt?: string
          eventId?: string | null
          id?: string
          isActive?: boolean
          isPinned?: boolean
          priority?: Database["public"]["Enums"]["AnnouncementPriority"]
          publishedAt?: string
          targetRole?: Database["public"]["Enums"]["Role"] | null
          title?: string
          updatedAt?: string
        }
        Relationships: []
      }
      artisan_applications: {
        Row: {
          craft_category: string
          craft_description: string | null
          created_at: string | null
          district: string | null
          document_references: string | null
          experience_years: number | null
          full_name: string | null
          id: string
          phone: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sample_images: string | null
          state: string | null
          status: string
          submitted_at: string | null
          updated_at: string | null
          user_id: string
          workshop_info: string | null
        }
        Insert: {
          craft_category: string
          craft_description?: string | null
          created_at?: string | null
          district?: string | null
          document_references?: string | null
          experience_years?: number | null
          full_name?: string | null
          id?: string
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_images?: string | null
          state?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
          user_id: string
          workshop_info?: string | null
        }
        Update: {
          craft_category?: string
          craft_description?: string | null
          created_at?: string | null
          district?: string | null
          document_references?: string | null
          experience_years?: number | null
          full_name?: string | null
          id?: string
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_images?: string | null
          state?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
          user_id?: string
          workshop_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artisan_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      artisan_earnings: {
        Row: {
          artisan_id: string
          artisan_wage_payout: number
          gross_amount: number
          id: string
          materials_cost: number
          middleman_saved: number
          order_id: string
          order_type: string | null
          payout_date: string | null
          product_title: string
          quantity: number | null
          status: string | null
        }
        Insert: {
          artisan_id: string
          artisan_wage_payout: number
          gross_amount: number
          id?: string
          materials_cost: number
          middleman_saved: number
          order_id: string
          order_type?: string | null
          payout_date?: string | null
          product_title: string
          quantity?: number | null
          status?: string | null
        }
        Update: {
          artisan_id?: string
          artisan_wage_payout?: number
          gross_amount?: number
          id?: string
          materials_cost?: number
          middleman_saved?: number
          order_id?: string
          order_type?: string | null
          payout_date?: string | null
          product_title?: string
          quantity?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artisan_earnings_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      artisan_inquiries: {
        Row: {
          artisan_id: string | null
          artisan_name: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          inquiry_type: string | null
          message: string
          product_id: string | null
          product_image: string | null
          product_title: string
          quantity: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          artisan_id?: string | null
          artisan_name?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          inquiry_type?: string | null
          message: string
          product_id?: string | null
          product_image?: string | null
          product_title: string
          quantity?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          artisan_id?: string | null
          artisan_name?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          inquiry_type?: string | null
          message?: string
          product_id?: string | null
          product_image?: string | null
          product_title?: string
          quantity?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      artisan_orders: {
        Row: {
          artisan_id: string
          created_at: string | null
          customer_id: string | null
          id: string
          order_number: string
          product_id: string | null
          quantity: number
          status: string | null
          total_price: number
        }
        Insert: {
          artisan_id: string
          created_at?: string | null
          customer_id?: string | null
          id?: string
          order_number: string
          product_id?: string | null
          quantity: number
          status?: string | null
          total_price: number
        }
        Update: {
          artisan_id?: string
          created_at?: string | null
          customer_id?: string | null
          id?: string
          order_number?: string
          product_id?: string | null
          quantity?: number
          status?: string | null
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "artisan_orders_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "craft_products"
            referencedColumns: ["id"]
          },
        ]
      }
      artisans: {
        Row: {
          aadhaar_hash: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bio: string | null
          cluster_id: string | null
          cluster_name: string | null
          craft: string
          created_at: string | null
          daily_capacity_units: number | null
          district: string | null
          experience_years: number | null
          full_name: string | null
          gender: string | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          latitude: number | null
          longitude: number | null
          masked_aadhaar: string | null
          monthly_capacity_units: number | null
          phone_number: string | null
          preferred_language: string | null
          primary_craft: string | null
          profile_photo_url: string | null
          social_category: string | null
          state: string | null
          updated_at: string | null
          upi_id: string | null
          village: string | null
          voice_intro_url: string | null
        }
        Insert: {
          aadhaar_hash?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bio?: string | null
          cluster_id?: string | null
          cluster_name?: string | null
          craft: string
          created_at?: string | null
          daily_capacity_units?: number | null
          district?: string | null
          experience_years?: number | null
          full_name?: string | null
          gender?: string | null
          id: string
          is_active?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          longitude?: number | null
          masked_aadhaar?: string | null
          monthly_capacity_units?: number | null
          phone_number?: string | null
          preferred_language?: string | null
          primary_craft?: string | null
          profile_photo_url?: string | null
          social_category?: string | null
          state?: string | null
          updated_at?: string | null
          upi_id?: string | null
          village?: string | null
          voice_intro_url?: string | null
        }
        Update: {
          aadhaar_hash?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bio?: string | null
          cluster_id?: string | null
          cluster_name?: string | null
          craft?: string
          created_at?: string | null
          daily_capacity_units?: number | null
          district?: string | null
          experience_years?: number | null
          full_name?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          longitude?: number | null
          masked_aadhaar?: string | null
          monthly_capacity_units?: number | null
          phone_number?: string | null
          preferred_language?: string | null
          primary_craft?: string | null
          profile_photo_url?: string | null
          social_category?: string | null
          state?: string | null
          updated_at?: string | null
          upi_id?: string | null
          village?: string | null
          voice_intro_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artisans_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      Attendance: {
        Row: {
          checkInType: Database["public"]["Enums"]["CheckInType"]
          createdAt: string
          eventId: string
          id: string
          markedAt: string
          notes: string | null
          participantId: string
          qrPassId: string | null
          scannedById: string
          status: Database["public"]["Enums"]["AttendanceStatus"]
          updatedAt: string
          userId: string
        }
        Insert: {
          checkInType?: Database["public"]["Enums"]["CheckInType"]
          createdAt?: string
          eventId: string
          id: string
          markedAt?: string
          notes?: string | null
          participantId: string
          qrPassId?: string | null
          scannedById: string
          status?: Database["public"]["Enums"]["AttendanceStatus"]
          updatedAt: string
          userId: string
        }
        Update: {
          checkInType?: Database["public"]["Enums"]["CheckInType"]
          createdAt?: string
          eventId?: string
          id?: string
          markedAt?: string
          notes?: string | null
          participantId?: string
          qrPassId?: string | null
          scannedById?: string
          status?: Database["public"]["Enums"]["AttendanceStatus"]
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Attendance_eventId_fkey"
            columns: ["eventId"]
            isOneToOne: false
            referencedRelation: "Event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Attendance_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      AuditLog: {
        Row: {
          action: string
          details: string | null
          id: string
          ipAddress: string | null
          resource: string
          resourceId: string | null
          timestamp: string
          userAgent: string | null
          userId: string | null
        }
        Insert: {
          action: string
          details?: string | null
          id: string
          ipAddress?: string | null
          resource: string
          resourceId?: string | null
          timestamp?: string
          userAgent?: string | null
          userId?: string | null
        }
        Update: {
          action?: string
          details?: string | null
          id?: string
          ipAddress?: string | null
          resource?: string
          resourceId?: string | null
          timestamp?: string
          userAgent?: string | null
          userId?: string | null
        }
        Relationships: []
      }
      b2b_match_records: {
        Row: {
          artisan_id: string
          capacity_feasible: boolean
          created_at: string | null
          distance_km: number
          estimated_production_days: number
          id: string
          match_explanation: string
          match_percentage: number
          product_id: string | null
          quoted_unit_price: number
          rfq_id: string
          score_capacity: number
          score_craft: number
          score_location: number
          score_price: number
          status: string | null
        }
        Insert: {
          artisan_id: string
          capacity_feasible: boolean
          created_at?: string | null
          distance_km: number
          estimated_production_days: number
          id: string
          match_explanation: string
          match_percentage: number
          product_id?: string | null
          quoted_unit_price: number
          rfq_id: string
          score_capacity: number
          score_craft: number
          score_location: number
          score_price: number
          status?: string | null
        }
        Update: {
          artisan_id?: string
          capacity_feasible?: boolean
          created_at?: string | null
          distance_km?: number
          estimated_production_days?: number
          id?: string
          match_explanation?: string
          match_percentage?: number
          product_id?: string | null
          quoted_unit_price?: number
          rfq_id?: string
          score_capacity?: number
          score_craft?: number
          score_location?: number
          score_price?: number
          status?: string | null
        }
        Relationships: []
      }
      b2b_rfqs: {
        Row: {
          buyer_email: string | null
          buyer_id: string | null
          buyer_name: string | null
          buyer_organization: string | null
          buyer_phone: string | null
          craft_type: string
          created_at: string | null
          deadline_days: number | null
          delivery_deadline: string | null
          delivery_district: string | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          delivery_state: string | null
          id: string
          idempotency_key: string | null
          quantity: number
          required_quantity: number | null
          status: string | null
          total_budget: number | null
          unit_budget: number
        }
        Insert: {
          buyer_email?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          buyer_organization?: string | null
          buyer_phone?: string | null
          craft_type: string
          created_at?: string | null
          deadline_days?: number | null
          delivery_deadline?: string | null
          delivery_district?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_state?: string | null
          id?: string
          idempotency_key?: string | null
          quantity: number
          required_quantity?: number | null
          status?: string | null
          total_budget?: number | null
          unit_budget: number
        }
        Update: {
          buyer_email?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          buyer_organization?: string | null
          buyer_phone?: string | null
          craft_type?: string
          created_at?: string | null
          deadline_days?: number | null
          delivery_deadline?: string | null
          delivery_district?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_state?: string | null
          id?: string
          idempotency_key?: string | null
          quantity?: number
          required_quantity?: number | null
          status?: string | null
          total_budget?: number | null
          unit_budget?: number
        }
        Relationships: [
          {
            foreignKeyName: "b2b_rfqs_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      Category: {
        Row: {
          accentColor: string
          createdAt: string
          description: string | null
          iconName: string | null
          id: string
          name: string
          order: number
          slug: string
          type: Database["public"]["Enums"]["CategoryType"]
          updatedAt: string
        }
        Insert: {
          accentColor?: string
          createdAt?: string
          description?: string | null
          iconName?: string | null
          id: string
          name: string
          order?: number
          slug: string
          type: Database["public"]["Enums"]["CategoryType"]
          updatedAt: string
        }
        Update: {
          accentColor?: string
          createdAt?: string
          description?: string | null
          iconName?: string | null
          id?: string
          name?: string
          order?: number
          slug?: string
          type?: Database["public"]["Enums"]["CategoryType"]
          updatedAt?: string
        }
        Relationships: []
      }
      Certificate: {
        Row: {
          categoryName: string
          certificateNumber: string
          createdAt: string
          eventId: string | null
          eventTitle: string
          id: string
          issuedAt: string
          participantId: string
          pdfUrl: string | null
          position: Database["public"]["Enums"]["ResultPosition"] | null
          recipientName: string
          signatureHash: string
          type: Database["public"]["Enums"]["CertificateType"]
          updatedAt: string
          userId: string
        }
        Insert: {
          categoryName: string
          certificateNumber: string
          createdAt?: string
          eventId?: string | null
          eventTitle: string
          id: string
          issuedAt?: string
          participantId: string
          pdfUrl?: string | null
          position?: Database["public"]["Enums"]["ResultPosition"] | null
          recipientName: string
          signatureHash: string
          type: Database["public"]["Enums"]["CertificateType"]
          updatedAt: string
          userId: string
        }
        Update: {
          categoryName?: string
          certificateNumber?: string
          createdAt?: string
          eventId?: string | null
          eventTitle?: string
          id?: string
          issuedAt?: string
          participantId?: string
          pdfUrl?: string | null
          position?: Database["public"]["Enums"]["ResultPosition"] | null
          recipientName?: string
          signatureHash?: string
          type?: Database["public"]["Enums"]["CertificateType"]
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Certificate_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      CheckInLog: {
        Row: {
          attendanceId: string | null
          checkInType: Database["public"]["Enums"]["CheckInType"]
          eventId: string | null
          id: string
          ipAddress: string | null
          participantId: string
          qrPassId: string | null
          reason: string | null
          scannedAt: string
          scannerId: string
          success: boolean
          userAgent: string | null
        }
        Insert: {
          attendanceId?: string | null
          checkInType?: Database["public"]["Enums"]["CheckInType"]
          eventId?: string | null
          id: string
          ipAddress?: string | null
          participantId: string
          qrPassId?: string | null
          reason?: string | null
          scannedAt?: string
          scannerId: string
          success?: boolean
          userAgent?: string | null
        }
        Update: {
          attendanceId?: string | null
          checkInType?: Database["public"]["Enums"]["CheckInType"]
          eventId?: string | null
          id?: string
          ipAddress?: string | null
          participantId?: string
          qrPassId?: string | null
          reason?: string | null
          scannedAt?: string
          scannerId?: string
          success?: boolean
          userAgent?: string | null
        }
        Relationships: []
      }
      CommitteeMember: {
        Row: {
          avatarUrl: string | null
          branch: string | null
          category: string
          createdAt: string
          designation: string
          email: string | null
          id: string
          isActive: boolean
          name: string
          order: number
          phone: string | null
          updatedAt: string
        }
        Insert: {
          avatarUrl?: string | null
          branch?: string | null
          category?: string
          createdAt?: string
          designation: string
          email?: string | null
          id: string
          isActive?: boolean
          name: string
          order?: number
          phone?: string | null
          updatedAt: string
        }
        Update: {
          avatarUrl?: string | null
          branch?: string | null
          category?: string
          createdAt?: string
          designation?: string
          email?: string | null
          id?: string
          isActive?: boolean
          name?: string
          order?: number
          phone?: string | null
          updatedAt?: string
        }
        Relationships: []
      }
      craft_clusters: {
        Row: {
          craft_name: string
          created_at: string | null
          description: string | null
          district: string
          gi_tag_number: string | null
          gi_tag_status: string
          id: string
          latitude: number
          longitude: number
          materials: Json | null
          name: string
          state: string
          statutory_daily_wage: number
          statutory_hourly_wage: number
          techniques: Json | null
          updated_at: string | null
        }
        Insert: {
          craft_name: string
          created_at?: string | null
          description?: string | null
          district: string
          gi_tag_number?: string | null
          gi_tag_status: string
          id: string
          latitude: number
          longitude: number
          materials?: Json | null
          name: string
          state: string
          statutory_daily_wage: number
          statutory_hourly_wage: number
          techniques?: Json | null
          updated_at?: string | null
        }
        Update: {
          craft_name?: string
          created_at?: string | null
          description?: string | null
          district?: string
          gi_tag_number?: string | null
          gi_tag_status?: string
          id?: string
          latitude?: number
          longitude?: number
          materials?: Json | null
          name?: string
          state?: string
          statutory_daily_wage?: number
          statutory_hourly_wage?: number
          techniques?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      craft_products: {
        Row: {
          artisan_id: string
          available_stock: number | null
          color: string | null
          cost_materials: number | null
          craft_type: string
          created_at: string | null
          description_en: string | null
          description_hi: string | null
          dimensions: string | null
          id: string
          image_url: string | null
          is_published: boolean | null
          materials: string[] | null
          price: number
          production_time_days: number | null
          seo_tags: string[] | null
          status: string | null
          statutory_daily_wage: number | null
          technique: string | null
          title_en: string
          title_hi: string | null
          updated_at: string | null
        }
        Insert: {
          artisan_id: string
          available_stock?: number | null
          color?: string | null
          cost_materials?: number | null
          craft_type: string
          created_at?: string | null
          description_en?: string | null
          description_hi?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          materials?: string[] | null
          price: number
          production_time_days?: number | null
          seo_tags?: string[] | null
          status?: string | null
          statutory_daily_wage?: number | null
          technique?: string | null
          title_en: string
          title_hi?: string | null
          updated_at?: string | null
        }
        Update: {
          artisan_id?: string
          available_stock?: number | null
          color?: string | null
          cost_materials?: number | null
          craft_type?: string
          created_at?: string | null
          description_en?: string | null
          description_hi?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          materials?: string[] | null
          price?: number
          production_time_days?: number | null
          seo_tags?: string[] | null
          status?: string | null
          statutory_daily_wage?: number | null
          technique?: string | null
          title_en?: string
          title_hi?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "craft_products_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_cart: {
        Row: {
          created_at: string | null
          customer_id: string
          id: string
          product_id: string
          quantity: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_cart_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_cart_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "craft_products"
            referencedColumns: ["id"]
          },
        ]
      }
      deactivated_users: {
        Row: {
          deactivated_at: string | null
          id: string
          reason: string | null
        }
        Insert: {
          deactivated_at?: string | null
          id: string
          reason?: string | null
        }
        Update: {
          deactivated_at?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      dpdp_consent_logs: {
        Row: {
          artisan_id: string | null
          consent_artifact_hash: string | null
          consent_artifact_type: string | null
          consent_type: string
          granted: boolean
          id: string
          ip_address: string | null
          language: string | null
          purpose: string
          revoked_at: string | null
          timestamp: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          artisan_id?: string | null
          consent_artifact_hash?: string | null
          consent_artifact_type?: string | null
          consent_type: string
          granted: boolean
          id: string
          ip_address?: string | null
          language?: string | null
          purpose: string
          revoked_at?: string | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          artisan_id?: string | null
          consent_artifact_hash?: string | null
          consent_artifact_type?: string | null
          consent_type?: string
          granted?: boolean
          id?: string
          ip_address?: string | null
          language?: string | null
          purpose?: string
          revoked_at?: string | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      Event: {
        Row: {
          bannerUrl: string | null
          categoryId: string
          coordinatorId: string | null
          coordinatorName: string | null
          coordinatorPhone: string | null
          createdAt: string
          description: string
          eventType: Database["public"]["Enums"]["EventType"]
          firstPrize: number
          id: string
          maxCapacity: number | null
          maxTeamSize: number
          minTeamSize: number
          order: number
          prizePool: number
          regEnd: string
          regStart: string
          rules: string | null
          scheduleEnd: string
          scheduleStart: string
          secondPrize: number
          slug: string
          status: Database["public"]["Enums"]["EventStatus"]
          thirdPrize: number
          title: string
          updatedAt: string
          venue: string
        }
        Insert: {
          bannerUrl?: string | null
          categoryId: string
          coordinatorId?: string | null
          coordinatorName?: string | null
          coordinatorPhone?: string | null
          createdAt?: string
          description: string
          eventType?: Database["public"]["Enums"]["EventType"]
          firstPrize?: number
          id: string
          maxCapacity?: number | null
          maxTeamSize?: number
          minTeamSize?: number
          order?: number
          prizePool?: number
          regEnd: string
          regStart: string
          rules?: string | null
          scheduleEnd: string
          scheduleStart: string
          secondPrize?: number
          slug: string
          status?: Database["public"]["Enums"]["EventStatus"]
          thirdPrize?: number
          title: string
          updatedAt: string
          venue: string
        }
        Update: {
          bannerUrl?: string | null
          categoryId?: string
          coordinatorId?: string | null
          coordinatorName?: string | null
          coordinatorPhone?: string | null
          createdAt?: string
          description?: string
          eventType?: Database["public"]["Enums"]["EventType"]
          firstPrize?: number
          id?: string
          maxCapacity?: number | null
          maxTeamSize?: number
          minTeamSize?: number
          order?: number
          prizePool?: number
          regEnd?: string
          regStart?: string
          rules?: string | null
          scheduleEnd?: string
          scheduleStart?: string
          secondPrize?: number
          slug?: string
          status?: Database["public"]["Enums"]["EventStatus"]
          thirdPrize?: number
          title?: string
          updatedAt?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "Event_categoryId_fkey"
            columns: ["categoryId"]
            isOneToOne: false
            referencedRelation: "Category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Event_coordinatorId_fkey"
            columns: ["coordinatorId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Faq: {
        Row: {
          answer: string
          category: string
          createdAt: string
          id: string
          isPublished: boolean
          order: number
          question: string
          updatedAt: string
        }
        Insert: {
          answer: string
          category?: string
          createdAt?: string
          id: string
          isPublished?: boolean
          order?: number
          question: string
          updatedAt: string
        }
        Update: {
          answer?: string
          category?: string
          createdAt?: string
          id?: string
          isPublished?: boolean
          order?: number
          question?: string
          updatedAt?: string
        }
        Relationships: []
      }
      GalleryItem: {
        Row: {
          category: string
          createdAt: string
          description: string | null
          id: string
          isFeatured: boolean
          mediaType: Database["public"]["Enums"]["MediaType"]
          order: number
          thumbnailUrl: string | null
          title: string
          updatedAt: string
          url: string
          year: number
        }
        Insert: {
          category?: string
          createdAt?: string
          description?: string | null
          id: string
          isFeatured?: boolean
          mediaType?: Database["public"]["Enums"]["MediaType"]
          order?: number
          thumbnailUrl?: string | null
          title: string
          updatedAt: string
          url: string
          year?: number
        }
        Update: {
          category?: string
          createdAt?: string
          description?: string | null
          id?: string
          isFeatured?: boolean
          mediaType?: Database["public"]["Enums"]["MediaType"]
          order?: number
          thumbnailUrl?: string | null
          title?: string
          updatedAt?: string
          url?: string
          year?: number
        }
        Relationships: []
      }
      Notification: {
        Row: {
          createdAt: string
          id: string
          isRead: boolean
          link: string | null
          message: string
          readAt: string | null
          title: string
          type: Database["public"]["Enums"]["NotificationType"]
          userId: string
        }
        Insert: {
          createdAt?: string
          id: string
          isRead?: boolean
          link?: string | null
          message: string
          readAt?: string | null
          title: string
          type?: Database["public"]["Enums"]["NotificationType"]
          userId: string
        }
        Update: {
          createdAt?: string
          id?: string
          isRead?: boolean
          link?: string | null
          message?: string
          readAt?: string | null
          title?: string
          type?: Database["public"]["Enums"]["NotificationType"]
          userId?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          artisan_id: string
          created_at: string | null
          customer_id: string
          id: string
          order_number: string
          paid_at: string | null
          payment_id: string | null
          payment_provider: string | null
          payment_status: string
          product_id: string
          product_title: string
          quantity: number
          status: string
          total_price: number
        }
        Insert: {
          artisan_id: string
          created_at?: string | null
          customer_id: string
          id: string
          order_number: string
          paid_at?: string | null
          payment_id?: string | null
          payment_provider?: string | null
          payment_status?: string
          product_id: string
          product_title: string
          quantity?: number
          status?: string
          total_price: number
        }
        Update: {
          artisan_id?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          order_number?: string
          paid_at?: string | null
          payment_id?: string | null
          payment_provider?: string | null
          payment_status?: string
          product_id?: string
          product_title?: string
          quantity?: number
          status?: string
          total_price?: number
        }
        Relationships: []
      }
      pricing_benchmarks: {
        Row: {
          benchmark_floor_price: number
          benchmark_retail_price: number
          benchmark_wholesale_price: number
          category: string
          cluster_id: string
          craft_type: string
          created_at: string | null
          id: string
          item_name: string
          materials: Json | null
          sample_image_url: string | null
          standard_labor_hours: number
          tags: Json | null
          visual_embedding: string | null
        }
        Insert: {
          benchmark_floor_price: number
          benchmark_retail_price: number
          benchmark_wholesale_price: number
          category: string
          cluster_id: string
          craft_type: string
          created_at?: string | null
          id: string
          item_name: string
          materials?: Json | null
          sample_image_url?: string | null
          standard_labor_hours: number
          tags?: Json | null
          visual_embedding?: string | null
        }
        Update: {
          benchmark_floor_price?: number
          benchmark_retail_price?: number
          benchmark_wholesale_price?: number
          category?: string
          cluster_id?: string
          craft_type?: string
          created_at?: string | null
          id?: string
          item_name?: string
          materials?: Json | null
          sample_image_url?: string | null
          standard_labor_hours?: number
          tags?: Json | null
          visual_embedding?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_benchmarks_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "craft_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          artisan_id: string
          before_after_preview_url: string | null
          cluster_id: string
          cost_materials: number
          craft_type: string
          created_at: string | null
          description_english: string | null
          description_hindi: string | null
          dimensions: Json | null
          dominant_colors: Json | null
          floor_price: number
          gi_artisan_authorization_status: string
          gi_authorization_document_reference: string | null
          gi_craft_registered: boolean
          gi_product_provenance_status: string
          gi_registered_region: string | null
          gi_registration_name: string | null
          gi_registration_reference: string | null
          gi_verification_date: string | null
          gi_verification_source: string | null
          hourly_wage_rate: number
          id: string
          idempotency_key: string | null
          is_active: boolean | null
          labor_hours: number
          listing_price: number
          materials: Json | null
          production_time_hours: number
          qr_passport_id: string | null
          raw_audio_url: string | null
          raw_photo_url: string | null
          recommended_retail_price: number
          seo_tags_english: Json | null
          seo_tags_hindi: Json | null
          stock_quantity: number | null
          studio_image_url: string | null
          technique: string
          title: string
          transcription_english: string | null
          transcription_regional: string | null
          updated_at: string | null
          visual_embedding: string | null
          wholesale_b2b_price: number
        }
        Insert: {
          artisan_id: string
          before_after_preview_url?: string | null
          cluster_id: string
          cost_materials?: number
          craft_type: string
          created_at?: string | null
          description_english?: string | null
          description_hindi?: string | null
          dimensions?: Json | null
          dominant_colors?: Json | null
          floor_price: number
          gi_artisan_authorization_status?: string
          gi_authorization_document_reference?: string | null
          gi_craft_registered?: boolean
          gi_product_provenance_status?: string
          gi_registered_region?: string | null
          gi_registration_name?: string | null
          gi_registration_reference?: string | null
          gi_verification_date?: string | null
          gi_verification_source?: string | null
          hourly_wage_rate?: number
          id: string
          idempotency_key?: string | null
          is_active?: boolean | null
          labor_hours?: number
          listing_price: number
          materials?: Json | null
          production_time_hours?: number
          qr_passport_id?: string | null
          raw_audio_url?: string | null
          raw_photo_url?: string | null
          recommended_retail_price: number
          seo_tags_english?: Json | null
          seo_tags_hindi?: Json | null
          stock_quantity?: number | null
          studio_image_url?: string | null
          technique: string
          title: string
          transcription_english?: string | null
          transcription_regional?: string | null
          updated_at?: string | null
          visual_embedding?: string | null
          wholesale_b2b_price: number
        }
        Update: {
          artisan_id?: string
          before_after_preview_url?: string | null
          cluster_id?: string
          cost_materials?: number
          craft_type?: string
          created_at?: string | null
          description_english?: string | null
          description_hindi?: string | null
          dimensions?: Json | null
          dominant_colors?: Json | null
          floor_price?: number
          gi_artisan_authorization_status?: string
          gi_authorization_document_reference?: string | null
          gi_craft_registered?: boolean
          gi_product_provenance_status?: string
          gi_registered_region?: string | null
          gi_registration_name?: string | null
          gi_registration_reference?: string | null
          gi_verification_date?: string | null
          gi_verification_source?: string | null
          hourly_wage_rate?: number
          id?: string
          idempotency_key?: string | null
          is_active?: boolean | null
          labor_hours?: number
          listing_price?: number
          materials?: Json | null
          production_time_hours?: number
          qr_passport_id?: string | null
          raw_audio_url?: string | null
          raw_photo_url?: string | null
          recommended_retail_price?: number
          seo_tags_english?: Json | null
          seo_tags_hindi?: Json | null
          stock_quantity?: number | null
          studio_image_url?: string | null
          technique?: string
          title?: string
          transcription_english?: string | null
          transcription_regional?: string | null
          updated_at?: string | null
          visual_embedding?: string | null
          wholesale_b2b_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "craft_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      Profile: {
        Row: {
          bio: string | null
          branch: Database["public"]["Enums"]["Branch"]
          collegeId: string
          collegeName: string
          createdAt: string
          emergencyContact: string | null
          gender: Database["public"]["Enums"]["Gender"]
          hostelName: string | null
          id: string
          isHosteler: boolean
          participantId: string
          phone: string
          qrPassToken: string | null
          roomNumber: string | null
          semester: number
          updatedAt: string
          userId: string
        }
        Insert: {
          bio?: string | null
          branch?: Database["public"]["Enums"]["Branch"]
          collegeId: string
          collegeName?: string
          createdAt?: string
          emergencyContact?: string | null
          gender?: Database["public"]["Enums"]["Gender"]
          hostelName?: string | null
          id: string
          isHosteler?: boolean
          participantId: string
          phone: string
          qrPassToken?: string | null
          roomNumber?: string | null
          semester?: number
          updatedAt: string
          userId: string
        }
        Update: {
          bio?: string | null
          branch?: Database["public"]["Enums"]["Branch"]
          collegeId?: string
          collegeName?: string
          createdAt?: string
          emergencyContact?: string | null
          gender?: Database["public"]["Enums"]["Gender"]
          hostelName?: string | null
          id?: string
          isHosteler?: boolean
          participantId?: string
          phone?: string
          qrPassToken?: string | null
          roomNumber?: string | null
          semester?: number
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Profile_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          craft_category: string | null
          created_at: string | null
          full_name: string | null
          id: string
          onboarding_completed: boolean | null
          phone: string | null
          preferred_language: string | null
          role: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          craft_category?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          role?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          craft_category?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          role?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      QrPass: {
        Row: {
          createdAt: string
          encryptedPayload: string
          eventId: string | null
          expiresAt: string
          id: string
          isRevoked: boolean
          issuedAt: string
          revokedAt: string | null
          revokedById: string | null
          tokenDigest: string
          updatedAt: string
          userId: string
        }
        Insert: {
          createdAt?: string
          encryptedPayload: string
          eventId?: string | null
          expiresAt: string
          id: string
          isRevoked?: boolean
          issuedAt?: string
          revokedAt?: string | null
          revokedById?: string | null
          tokenDigest: string
          updatedAt: string
          userId: string
        }
        Update: {
          createdAt?: string
          encryptedPayload?: string
          eventId?: string | null
          expiresAt?: string
          id?: string
          isRevoked?: boolean
          issuedAt?: string
          revokedAt?: string | null
          revokedById?: string | null
          tokenDigest?: string
          updatedAt?: string
          userId?: string
        }
        Relationships: []
      }
      RateLimitEntry: {
        Row: {
          count: number
          expiresAt: string
          key: string
          windowStart: string
        }
        Insert: {
          count?: number
          expiresAt: string
          key: string
          windowStart?: string
        }
        Update: {
          count?: number
          expiresAt?: string
          key?: string
          windowStart?: string
        }
        Relationships: []
      }
      Registration: {
        Row: {
          attended: boolean
          attendedAt: string | null
          createdAt: string
          eventId: string
          id: string
          qrCodeToken: string | null
          registeredAt: string
          registrationNumber: string
          status: Database["public"]["Enums"]["RegistrationStatus"]
          teamId: string | null
          updatedAt: string
          userId: string
        }
        Insert: {
          attended?: boolean
          attendedAt?: string | null
          createdAt?: string
          eventId: string
          id: string
          qrCodeToken?: string | null
          registeredAt?: string
          registrationNumber: string
          status?: Database["public"]["Enums"]["RegistrationStatus"]
          teamId?: string | null
          updatedAt: string
          userId: string
        }
        Update: {
          attended?: boolean
          attendedAt?: string | null
          createdAt?: string
          eventId?: string
          id?: string
          qrCodeToken?: string | null
          registeredAt?: string
          registrationNumber?: string
          status?: Database["public"]["Enums"]["RegistrationStatus"]
          teamId?: string | null
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Registration_eventId_fkey"
            columns: ["eventId"]
            isOneToOne: false
            referencedRelation: "Event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Registration_teamId_fkey"
            columns: ["teamId"]
            isOneToOne: false
            referencedRelation: "Team"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Registration_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Result: {
        Row: {
          createdAt: string
          eventId: string
          id: string
          position: Database["public"]["Enums"]["ResultPosition"]
          publishedAt: string
          rank: number
          remarks: string | null
          score: number | null
          teamId: string | null
          updatedAt: string
          userId: string | null
        }
        Insert: {
          createdAt?: string
          eventId: string
          id: string
          position: Database["public"]["Enums"]["ResultPosition"]
          publishedAt?: string
          rank?: number
          remarks?: string | null
          score?: number | null
          teamId?: string | null
          updatedAt: string
          userId?: string | null
        }
        Update: {
          createdAt?: string
          eventId?: string
          id?: string
          position?: Database["public"]["Enums"]["ResultPosition"]
          publishedAt?: string
          rank?: number
          remarks?: string | null
          score?: number | null
          teamId?: string | null
          updatedAt?: string
          userId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Result_eventId_fkey"
            columns: ["eventId"]
            isOneToOne: false
            referencedRelation: "Event"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations_ledger: {
        Row: {
          applied_at: string
          checksum: string | null
          execution_time_ms: number | null
          migration_id: string
          name: string
        }
        Insert: {
          applied_at?: string
          checksum?: string | null
          execution_time_ms?: number | null
          migration_id: string
          name: string
        }
        Update: {
          applied_at?: string
          checksum?: string | null
          execution_time_ms?: number | null
          migration_id?: string
          name?: string
        }
        Relationships: []
      }
      Sponsor: {
        Row: {
          createdAt: string
          description: string | null
          id: string
          isActive: boolean
          logoUrl: string
          name: string
          order: number
          tier: Database["public"]["Enums"]["SponsorTier"]
          updatedAt: string
          websiteUrl: string | null
        }
        Insert: {
          createdAt?: string
          description?: string | null
          id: string
          isActive?: boolean
          logoUrl: string
          name: string
          order?: number
          tier?: Database["public"]["Enums"]["SponsorTier"]
          updatedAt: string
          websiteUrl?: string | null
        }
        Update: {
          createdAt?: string
          description?: string | null
          id?: string
          isActive?: boolean
          logoUrl?: string
          name?: string
          order?: number
          tier?: Database["public"]["Enums"]["SponsorTier"]
          updatedAt?: string
          websiteUrl?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      Team: {
        Row: {
          captainId: string
          createdAt: string
          eventId: string
          id: string
          inviteCode: string
          maxSize: number
          minSize: number
          name: string
          status: Database["public"]["Enums"]["TeamStatus"]
          updatedAt: string
        }
        Insert: {
          captainId: string
          createdAt?: string
          eventId: string
          id: string
          inviteCode: string
          maxSize: number
          minSize: number
          name: string
          status?: Database["public"]["Enums"]["TeamStatus"]
          updatedAt: string
        }
        Update: {
          captainId?: string
          createdAt?: string
          eventId?: string
          id?: string
          inviteCode?: string
          maxSize?: number
          minSize?: number
          name?: string
          status?: Database["public"]["Enums"]["TeamStatus"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Team_captainId_fkey"
            columns: ["captainId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Team_eventId_fkey"
            columns: ["eventId"]
            isOneToOne: false
            referencedRelation: "Event"
            referencedColumns: ["id"]
          },
        ]
      }
      TeamMember: {
        Row: {
          createdAt: string
          id: string
          joinedAt: string
          role: Database["public"]["Enums"]["TeamMemberRole"]
          status: Database["public"]["Enums"]["MemberStatus"]
          teamId: string
          updatedAt: string
          userId: string
        }
        Insert: {
          createdAt?: string
          id: string
          joinedAt?: string
          role?: Database["public"]["Enums"]["TeamMemberRole"]
          status?: Database["public"]["Enums"]["MemberStatus"]
          teamId: string
          updatedAt: string
          userId: string
        }
        Update: {
          createdAt?: string
          id?: string
          joinedAt?: string
          role?: Database["public"]["Enums"]["TeamMemberRole"]
          status?: Database["public"]["Enums"]["MemberStatus"]
          teamId?: string
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "TeamMember_teamId_fkey"
            columns: ["teamId"]
            isOneToOne: false
            referencedRelation: "Team"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "TeamMember_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      User: {
        Row: {
          avatarUrl: string | null
          createdAt: string
          email: string
          id: string
          isActive: boolean
          name: string
          passwordHash: string | null
          role: Database["public"]["Enums"]["Role"]
          updatedAt: string
        }
        Insert: {
          avatarUrl?: string | null
          createdAt?: string
          email: string
          id: string
          isActive?: boolean
          name: string
          passwordHash?: string | null
          role?: Database["public"]["Enums"]["Role"]
          updatedAt: string
        }
        Update: {
          avatarUrl?: string | null
          createdAt?: string
          email?: string
          id?: string
          isActive?: boolean
          name?: string
          passwordHash?: string | null
          role?: Database["public"]["Enums"]["Role"]
          updatedAt?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_artisan_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cluster_name: string | null
          craft: string | null
          district: string | null
          experience_years: number | null
          full_name: string | null
          id: string | null
          is_verified: boolean | null
          state: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artisans_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_user_role: { Args: never; Returns: string }
      ensure_artisan_record: {
        Args: { p_user_id: string }
        Returns: {
          aadhaar_hash: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bio: string | null
          cluster_id: string | null
          cluster_name: string | null
          craft: string
          created_at: string | null
          daily_capacity_units: number | null
          district: string | null
          experience_years: number | null
          full_name: string | null
          gender: string | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          latitude: number | null
          longitude: number | null
          masked_aadhaar: string | null
          monthly_capacity_units: number | null
          phone_number: string | null
          preferred_language: string | null
          primary_craft: string | null
          profile_photo_url: string | null
          social_category: string | null
          state: string | null
          updated_at: string | null
          upi_id: string | null
          village: string | null
          voice_intro_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "artisans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      AnnouncementCategory:
        | "GENERAL"
        | "EVENT_UPDATE"
        | "EMERGENCY"
        | "SCHEDULE_CHANGE"
        | "RESULTS"
      AnnouncementPriority: "URGENT" | "HIGH" | "NORMAL" | "LOW"
      AttendanceStatus: "PRESENT" | "LATE" | "EXCUSED"
      Branch: "CSE" | "ME" | "CE" | "EE" | "FPP" | "MC" | "OTHER"
      CategoryType: "SPORTS" | "CULTURAL" | "GAMING" | "LITERARY"
      CertificateType:
        | "WINNER"
        | "FIRST_RUNNER_UP"
        | "SECOND_RUNNER_UP"
        | "PARTICIPATION"
        | "VOLUNTEER"
        | "COORDINATOR"
        | "MERIT"
      CheckInType: "EVENT_ENTRY" | "GATE_ENTRY" | "MEAL" | "BADGE_VERIFY"
      EventStatus:
        | "UPCOMING"
        | "REGISTRATION_OPEN"
        | "REGISTRATION_CLOSED"
        | "ONGOING"
        | "COMPLETED"
        | "CANCELLED"
      EventType: "INDIVIDUAL" | "TEAM"
      Gender: "MALE" | "FEMALE" | "OTHER"
      MediaType: "IMAGE" | "VIDEO"
      MemberStatus: "PENDING" | "APPROVED" | "REJECTED"
      NotificationType:
        | "INFO"
        | "SUCCESS"
        | "WARNING"
        | "ALERT"
        | "REGISTRATION"
        | "RESULT"
        | "TEAM_INVITE"
      RegistrationStatus:
        | "PENDING"
        | "CONFIRMED"
        | "REJECTED"
        | "CANCELLED"
        | "ATTENDED"
      ResultPosition:
        | "WINNER"
        | "FIRST_RUNNER_UP"
        | "SECOND_RUNNER_UP"
        | "FINALIST"
        | "PARTICIPANT"
      Role:
        | "ADMIN"
        | "EVENT_COORDINATOR"
        | "VOLUNTEER"
        | "TEAM_CAPTAIN"
        | "PARTICIPANT"
      SponsorTier:
        | "TITLE"
        | "POWERED_BY"
        | "GOLD"
        | "SILVER"
        | "BRONZE"
        | "MEDIA_PARTNER"
        | "COMMUNITY_PARTNER"
      TeamMemberRole: "CAPTAIN" | "MEMBER"
      TeamStatus: "FORMING" | "READY" | "REGISTERED" | "DISQUALIFIED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      AnnouncementCategory: [
        "GENERAL",
        "EVENT_UPDATE",
        "EMERGENCY",
        "SCHEDULE_CHANGE",
        "RESULTS",
      ],
      AnnouncementPriority: ["URGENT", "HIGH", "NORMAL", "LOW"],
      AttendanceStatus: ["PRESENT", "LATE", "EXCUSED"],
      Branch: ["CSE", "ME", "CE", "EE", "FPP", "MC", "OTHER"],
      CategoryType: ["SPORTS", "CULTURAL", "GAMING", "LITERARY"],
      CertificateType: [
        "WINNER",
        "FIRST_RUNNER_UP",
        "SECOND_RUNNER_UP",
        "PARTICIPATION",
        "VOLUNTEER",
        "COORDINATOR",
        "MERIT",
      ],
      CheckInType: ["EVENT_ENTRY", "GATE_ENTRY", "MEAL", "BADGE_VERIFY"],
      EventStatus: [
        "UPCOMING",
        "REGISTRATION_OPEN",
        "REGISTRATION_CLOSED",
        "ONGOING",
        "COMPLETED",
        "CANCELLED",
      ],
      EventType: ["INDIVIDUAL", "TEAM"],
      Gender: ["MALE", "FEMALE", "OTHER"],
      MediaType: ["IMAGE", "VIDEO"],
      MemberStatus: ["PENDING", "APPROVED", "REJECTED"],
      NotificationType: [
        "INFO",
        "SUCCESS",
        "WARNING",
        "ALERT",
        "REGISTRATION",
        "RESULT",
        "TEAM_INVITE",
      ],
      RegistrationStatus: [
        "PENDING",
        "CONFIRMED",
        "REJECTED",
        "CANCELLED",
        "ATTENDED",
      ],
      ResultPosition: [
        "WINNER",
        "FIRST_RUNNER_UP",
        "SECOND_RUNNER_UP",
        "FINALIST",
        "PARTICIPANT",
      ],
      Role: [
        "ADMIN",
        "EVENT_COORDINATOR",
        "VOLUNTEER",
        "TEAM_CAPTAIN",
        "PARTICIPANT",
      ],
      SponsorTier: [
        "TITLE",
        "POWERED_BY",
        "GOLD",
        "SILVER",
        "BRONZE",
        "MEDIA_PARTNER",
        "COMMUNITY_PARTNER",
      ],
      TeamMemberRole: ["CAPTAIN", "MEMBER"],
      TeamStatus: ["FORMING", "READY", "REGISTERED", "DISQUALIFIED"],
    },
  },
} as const
