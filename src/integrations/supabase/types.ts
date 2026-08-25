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
          salon_id: string
          salon_category_id: string | null
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
          salon_id: string
          salon_category_id?: string | null
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
          salon_id?: string
          salon_category_id?: string | null
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
            foreignKeyName: "salon_services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
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
        Relationships: []
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
        Relationships: []
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
