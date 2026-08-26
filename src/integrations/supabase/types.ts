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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      customer_phone_otps: {
        Row: {
          code: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          salon_id: string
        }
        Insert: {
          code: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          salon_id: string
        }
        Update: {
          code?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_phone_otps_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_resend_limits: {
        Row: {
          next_resend_at: string
          phone: string
          resend_count: number
          updated_at: string
        }
        Insert: {
          next_resend_at: string
          phone: string
          resend_count?: number
          updated_at?: string
        }
        Update: {
          next_resend_at?: string
          phone?: string
          resend_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      phone_otps: {
        Row: {
          attempts: number
          code: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
        }
        Insert: {
          attempts?: number
          code: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
        }
        Update: {
          attempts?: number
          code?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string
          profile_completed: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone: string
          profile_completed?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string
          profile_completed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      salon_booking_services: {
        Row: {
          booking_id: string
          created_at: string
          salon_service_id: string
          team_member_id: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          salon_service_id: string
          team_member_id?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          salon_service_id?: string
          team_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salon_booking_services_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "salon_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_booking_services_salon_service_id_fkey"
            columns: ["salon_service_id"]
            isOneToOne: false
            referencedRelation: "salon_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_booking_services_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_bookings: {
        Row: {
          client_name: string
          client_phone: string
          completed_at: string | null
          created_at: string
          customer_id: string | null
          deal_id: string | null
          ends_at: string
          id: string
          notes: string | null
          package_id: string | null
          rating: number | null
          review_comment: string | null
          salon_id: string
          started_at: string | null
          starts_at: string
          status: string
          team_member_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          client_name: string
          client_phone: string
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          deal_id?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          package_id?: string | null
          rating?: number | null
          review_comment?: string | null
          salon_id: string
          started_at?: string | null
          starts_at: string
          status?: string
          team_member_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          client_name?: string
          client_phone?: string
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          deal_id?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          package_id?: string | null
          rating?: number | null
          review_comment?: string | null
          salon_id?: string
          started_at?: string | null
          starts_at?: string
          status?: string
          team_member_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "salon_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_bookings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "salon_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "salon_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_bookings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_bookings_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_categories: {
        Row: {
          appointment_color: string
          category_id: string | null
          description: string | null
          id: string
          image_url: string | null
          is_predefined: boolean
          name: string
          salon_id: string
          sort_order: number
        }
        Insert: {
          appointment_color?: string
          category_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_predefined?: boolean
          name: string
          salon_id: string
          sort_order?: number
        }
        Update: {
          appointment_color?: string
          category_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_predefined?: boolean
          name?: string
          salon_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "salon_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_categories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_customers: {
        Row: {
          created_at: string
          first_name: string
          id: string
          last_name: string
          phone: string
          phone_verified_at: string | null
          salon_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          phone: string
          phone_verified_at?: string | null
          salon_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string
          phone_verified_at?: string | null
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_customers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_deal_services: {
        Row: {
          created_at: string
          deal_id: string
          salon_service_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          salon_service_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          salon_service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_deal_services_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "salon_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_deal_services_salon_service_id_fkey"
            columns: ["salon_service_id"]
            isOneToOne: false
            referencedRelation: "salon_services"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_deals: {
        Row: {
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          duration_count: number
          duration_unit: string
          ends_on: string
          gender: string
          id: string
          is_active: boolean
          max_discount_amount: number | null
          name: string
          offered_price: number
          original_price: number
          pricing_option: string
          salon_id: string
          starts_on: string
          status: string
          terms: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value?: number
          duration_count?: number
          duration_unit?: string
          ends_on: string
          gender?: string
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          name: string
          offered_price?: number
          original_price?: number
          pricing_option?: string
          salon_id: string
          starts_on: string
          status?: string
          terms?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          duration_count?: number
          duration_unit?: string
          ends_on?: string
          gender?: string
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          name?: string
          offered_price?: number
          original_price?: number
          pricing_option?: string
          salon_id?: string
          starts_on?: string
          status?: string
          terms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_deals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_hours: {
        Row: {
          close_time: string
          day_of_week: number
          id: string
          is_open: boolean
          open_time: string
          salon_id: string
        }
        Insert: {
          close_time?: string
          day_of_week: number
          id?: string
          is_open?: boolean
          open_time?: string
          salon_id: string
        }
        Update: {
          close_time?: string
          day_of_week?: number
          id?: string
          is_open?: boolean
          open_time?: string
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_hours_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_images: {
        Row: {
          created_at: string
          id: string
          public_url: string
          salon_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          public_url: string
          salon_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          public_url?: string
          salon_id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_images_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_package_services: {
        Row: {
          created_at: string
          package_id: string
          salon_service_id: string
        }
        Insert: {
          created_at?: string
          package_id: string
          salon_service_id: string
        }
        Update: {
          created_at?: string
          package_id?: string
          salon_service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_package_services_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "salon_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_package_services_salon_service_id_fkey"
            columns: ["salon_service_id"]
            isOneToOne: false
            referencedRelation: "salon_services"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_packages: {
        Row: {
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          duration_count: number
          duration_unit: string
          gender: string
          id: string
          is_active: boolean
          max_discount_amount: number | null
          name: string
          offered_price: number
          original_price: number
          package_price: number
          pricing_option: string
          salon_id: string
          status: string
          terms: string | null
          updated_at: string
          validity_days: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          duration_count?: number
          duration_unit?: string
          gender?: string
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          name: string
          offered_price?: number
          original_price?: number
          package_price?: number
          pricing_option?: string
          salon_id: string
          status?: string
          terms?: string | null
          updated_at?: string
          validity_days?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          duration_count?: number
          duration_unit?: string
          gender?: string
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          name?: string
          offered_price?: number
          original_price?: number
          package_price?: number
          pricing_option?: string
          salon_id?: string
          status?: string
          terms?: string | null
          updated_at?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "salon_packages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_services: {
        Row: {
          busy_end_mins: number | null
          busy_start_mins: number | null
          category_id: string | null
          commission_type: string
          commission_value: number
          created_at: string
          description: string | null
          duration_mins: number
          id: string
          max_amount: number | null
          name: string
          passive_wait_enabled: boolean
          passive_wait_mins: number | null
          price: number
          salon_category_id: string | null
          salon_id: string
          salon_subcategory_id: string | null
          service_id: string | null
          subcategory_id: string | null
          updated_at: string
        }
        Insert: {
          busy_end_mins?: number | null
          busy_start_mins?: number | null
          category_id?: string | null
          commission_type?: string
          commission_value?: number
          created_at?: string
          description?: string | null
          duration_mins?: number
          id?: string
          max_amount?: number | null
          name: string
          passive_wait_enabled?: boolean
          passive_wait_mins?: number | null
          price?: number
          salon_category_id?: string | null
          salon_id: string
          salon_subcategory_id?: string | null
          service_id?: string | null
          subcategory_id?: string | null
          updated_at?: string
        }
        Update: {
          busy_end_mins?: number | null
          busy_start_mins?: number | null
          category_id?: string | null
          commission_type?: string
          commission_value?: number
          created_at?: string
          description?: string | null
          duration_mins?: number
          id?: string
          max_amount?: number | null
          name?: string
          passive_wait_enabled?: boolean
          passive_wait_mins?: number | null
          price?: number
          salon_category_id?: string | null
          salon_id?: string
          salon_subcategory_id?: string | null
          service_id?: string | null
          subcategory_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_services_salon_category_id_fkey"
            columns: ["salon_category_id"]
            isOneToOne: false
            referencedRelation: "salon_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_services_salon_subcategory_id_fkey"
            columns: ["salon_subcategory_id"]
            isOneToOne: false
            referencedRelation: "salon_subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_services_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "service_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_subcategories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          salon_category_id: string
          salon_id: string
          sort_order: number
          source_subcategory_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          salon_category_id: string
          salon_id: string
          sort_order?: number
          source_subcategory_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          salon_category_id?: string
          salon_id?: string
          sort_order?: number
          source_subcategory_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_subcategories_salon_category_id_fkey"
            columns: ["salon_category_id"]
            isOneToOne: false
            referencedRelation: "salon_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_subcategories_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_subcategories_source_subcategory_id_fkey"
            columns: ["source_subcategory_id"]
            isOneToOne: false
            referencedRelation: "service_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      salons: {
        Row: {
          about: string | null
          address: string | null
          city: string | null
          close_time: string
          created_at: string
          house_no: string | null
          id: string
          is_active: boolean
          is_stylist: boolean
          latitude: number | null
          longitude: number | null
          name: string
          open_time: string
          owner_id: string
          parent_id: string | null
          phone: string
          pincode: string | null
          state: string | null
          street: string | null
          updated_at: string
        }
        Insert: {
          about?: string | null
          address?: string | null
          city?: string | null
          close_time?: string
          created_at?: string
          house_no?: string | null
          id?: string
          is_active?: boolean
          is_stylist?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          open_time?: string
          owner_id: string
          parent_id?: string | null
          phone: string
          pincode?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
        }
        Update: {
          about?: string | null
          address?: string | null
          city?: string | null
          close_time?: string
          created_at?: string
          house_no?: string | null
          id?: string
          is_active?: boolean
          is_stylist?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          open_time?: string
          owner_id?: string
          parent_id?: string | null
          phone?: string
          pincode?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salons_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          id: string
          image_url: string | null
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          image_url?: string | null
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      service_subcategories: {
        Row: {
          category_id: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          category_id: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          category_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          default_duration_mins: number
          default_price: number
          id: string
          name: string
          subcategory_id: string
        }
        Insert: {
          default_duration_mins?: number
          default_price?: number
          id?: string
          name: string
          subcategory_id: string
        }
        Update: {
          default_duration_mins?: number
          default_price?: number
          id?: string
          name?: string
          subcategory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "service_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invite_otps: {
        Row: {
          code: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          invitation_id: string
          phone: string
        }
        Insert: {
          code: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          invitation_id: string
          phone: string
        }
        Update: {
          code?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invitation_id?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invite_otps_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "team_member_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_member_branches: {
        Row: {
          created_at: string
          salon_id: string
          team_member_id: string
        }
        Insert: {
          created_at?: string
          salon_id: string
          team_member_id: string
        }
        Update: {
          created_at?: string
          salon_id?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_member_branches_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_branches_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_member_hours: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_working: boolean
          salon_id: string
          start_time: string
          team_member_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time?: string
          id?: string
          is_working?: boolean
          salon_id: string
          start_time?: string
          team_member_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_working?: boolean
          salon_id?: string
          start_time?: string
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_member_hours_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_hours_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_member_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          first_name: string
          id: string
          last_name: string
          message: string | null
          owner_id: string
          phone: string | null
          salon_id: string
          status: string
          team_member_id: string
          token: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          first_name: string
          id?: string
          last_name: string
          message?: string | null
          owner_id: string
          phone?: string | null
          salon_id: string
          status?: string
          team_member_id: string
          token: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          first_name?: string
          id?: string
          last_name?: string
          message?: string | null
          owner_id?: string
          phone?: string | null
          salon_id?: string
          status?: string
          team_member_id?: string
          token?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_member_invitations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_invitations_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_member_services: {
        Row: {
          created_at: string
          salon_service_id: string
          team_member_id: string
        }
        Insert: {
          created_at?: string
          salon_service_id: string
          team_member_id: string
        }
        Update: {
          created_at?: string
          salon_service_id?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_member_services_salon_service_id_fkey"
            columns: ["salon_service_id"]
            isOneToOne: false
            referencedRelation: "salon_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_services_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          about: string | null
          address: string | null
          base_salary: number
          career_start_date: string | null
          commission_type: string
          commission_value: number
          compensation_later: boolean
          created_at: string
          effective_from: string | null
          email: string | null
          employment_type: string
          experience_years: number
          first_name: string | null
          full_name: string
          gender: string
          id: string
          invitation_status: string
          invited_at: string | null
          is_active: boolean
          joining_date: string | null
          last_name: string | null
          notes: string | null
          online_booking_enabled: boolean
          owner_id: string
          pay_type: string
          phone: string | null
          profile_image_url: string | null
          role_title: string
          roles: string[]
          setup_required: boolean
          source: string
          updated_at: string
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          about?: string | null
          address?: string | null
          base_salary?: number
          career_start_date?: string | null
          commission_type?: string
          commission_value?: number
          compensation_later?: boolean
          created_at?: string
          effective_from?: string | null
          email?: string | null
          employment_type?: string
          experience_years?: number
          first_name?: string | null
          full_name: string
          gender?: string
          id?: string
          invitation_status?: string
          invited_at?: string | null
          is_active?: boolean
          joining_date?: string | null
          last_name?: string | null
          notes?: string | null
          online_booking_enabled?: boolean
          owner_id: string
          pay_type?: string
          phone?: string | null
          profile_image_url?: string | null
          role_title?: string
          roles?: string[]
          setup_required?: boolean
          source?: string
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          about?: string | null
          address?: string | null
          base_salary?: number
          career_start_date?: string | null
          commission_type?: string
          commission_value?: number
          compensation_later?: boolean
          created_at?: string
          effective_from?: string | null
          email?: string | null
          employment_type?: string
          experience_years?: number
          first_name?: string | null
          full_name?: string
          gender?: string
          id?: string
          invitation_status?: string
          invited_at?: string | null
          is_active?: boolean
          joining_date?: string | null
          last_name?: string | null
          notes?: string | null
          online_booking_enabled?: boolean
          owner_id?: string
          pay_type?: string
          phone?: string | null
          profile_image_url?: string | null
          role_title?: string
          roles?: string[]
          setup_required?: boolean
          source?: string
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      owns_salon: { Args: { _salon_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
