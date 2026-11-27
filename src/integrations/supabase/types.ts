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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      academic_events: {
        Row: {
          audience_scope: Database["public"]["Enums"]["document_audience"]
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          event_type: Database["public"]["Enums"]["event_kind"]
          id: string
          is_published: boolean
          level_id: string | null
          location: string | null
          offering_id: string | null
          program_id: string | null
          semester_id: string | null
          starts_at: string
          target_student_user_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience_scope?: Database["public"]["Enums"]["document_audience"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["event_kind"]
          id?: string
          is_published?: boolean
          level_id?: string | null
          location?: string | null
          offering_id?: string | null
          program_id?: string | null
          semester_id?: string | null
          starts_at: string
          target_student_user_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience_scope?: Database["public"]["Enums"]["document_audience"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["event_kind"]
          id?: string
          is_published?: boolean
          level_id?: string | null
          location?: string | null
          offering_id?: string | null
          program_id?: string | null
          semester_id?: string | null
          starts_at?: string
          target_student_user_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_events_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "academic_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_events_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_events_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "academic_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_events_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_events_target_student_user_id_fkey"
            columns: ["target_student_user_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      academic_groups: {
        Row: {
          capacity: number | null
          created_at: string
          id: string
          instructor: string | null
          name: string
          offering_id: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          id?: string
          instructor?: string | null
          name: string
          offering_id: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          id?: string
          instructor?: string | null
          name?: string
          offering_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_groups_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_levels: {
        Row: {
          created_at: string
          id: string
          level_number: number
          name_ar: string
          program_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          level_number: number
          name_ar: string
          program_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          level_number?: number
          name_ar?: string
          program_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "academic_levels_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "academic_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_programs: {
        Row: {
          code: string
          created_at: string
          faculty: string | null
          id: string
          is_active: boolean
          name_ar: string
          name_en: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          faculty?: string | null
          id?: string
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          faculty?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      academic_years: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          name?: string
        }
        Relationships: []
      }
      admin_activity_logs: {
        Row: {
          action: string
          actor_label: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience_scope: Database["public"]["Enums"]["document_audience"]
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_archived: boolean
          is_published: boolean
          level_id: string | null
          program_id: string | null
          published_at: string | null
          target_student_user_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience_scope?: Database["public"]["Enums"]["document_audience"]
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          is_published?: boolean
          level_id?: string | null
          program_id?: string | null
          published_at?: string | null
          target_student_user_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience_scope?: Database["public"]["Enums"]["document_audience"]
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          is_published?: boolean
          level_id?: string | null
          program_id?: string | null
          published_at?: string | null
          target_student_user_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "academic_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "academic_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_target_student_user_id_fkey"
            columns: ["target_student_user_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      course_offerings: {
        Row: {
          course_id: string
          created_at: string
          id: string
          is_active: boolean
          level_id: string | null
          program_id: string | null
          semester_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          level_id?: string | null
          program_id?: string | null
          semester_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          level_id?: string | null
          program_id?: string | null
          semester_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_offerings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_offerings_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "academic_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_offerings_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "academic_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_offerings_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          created_at: string
          credit_hours: number
          id: string
          is_active: boolean
          name: string
          name_ar: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          credit_hours?: number
          id?: string
          is_active?: boolean
          name: string
          name_ar?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          credit_hours?: number
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          audience_scope: Database["public"]["Enums"]["document_audience"]
          created_at: string
          description: string | null
          doc_category: string
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          is_available: boolean
          level_id: string | null
          offering_id: string | null
          program_id: string | null
          sort_order: number
          target_student_user_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience_scope?: Database["public"]["Enums"]["document_audience"]
          created_at?: string
          description?: string | null
          doc_category?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_available?: boolean
          level_id?: string | null
          offering_id?: string | null
          program_id?: string | null
          sort_order?: number
          target_student_user_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience_scope?: Database["public"]["Enums"]["document_audience"]
          created_at?: string
          description?: string | null
          doc_category?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_available?: boolean
          level_id?: string | null
          offering_id?: string | null
          program_id?: string | null
          sort_order?: number
          target_student_user_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "academic_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "academic_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_target_student_user_id_fkey"
            columns: ["target_student_user_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      enrollments: {
        Row: {
          created_at: string
          group_id: string
          group_number: number | null
          id: string
          lab_number: number | null
          offering_id: string
          section_number: number | null
          status: string
          student_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          group_number?: number | null
          id?: string
          lab_number?: number | null
          offering_id: string
          section_number?: number | null
          status?: string
          student_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          group_number?: number | null
          id?: string
          lab_number?: number | null
          offering_id?: string
          section_number?: number | null
          status?: string
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "academic_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_group_offering_fkey"
            columns: ["group_id", "offering_id"]
            isOneToOne: false
            referencedRelation: "academic_groups"
            referencedColumns: ["id", "offering_id"]
          },
          {
            foreignKeyName: "enrollments_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lectures: {
        Row: {
          created_at: string
          day_of_week: string
          end_hour: number
          end_time: string
          group_id: string
          id: string
          instructor: string | null
          kind: Database["public"]["Enums"]["slot_kind"]
          location: string
          start_hour: number
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: string
          end_hour: number
          end_time: string
          group_id: string
          id?: string
          instructor?: string | null
          kind?: Database["public"]["Enums"]["slot_kind"]
          location: string
          start_hour: number
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: string
          end_hour?: number
          end_time?: string
          group_id?: string
          id?: string
          instructor?: string | null
          kind?: Database["public"]["Enums"]["slot_kind"]
          location?: string
          start_hour?: number
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "lectures_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "academic_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_intents: {
        Row: {
          consumed_at: string | null
          consumed_by_user_id: string | null
          created_at: string
          email: string
          expires_at: string
          full_name_ar: string
          full_name_en: string | null
          gender: string | null
          id: string
          phone: string | null
          roster_id: string | null
          student_code: string
        }
        Insert: {
          consumed_at?: string | null
          consumed_by_user_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          full_name_ar: string
          full_name_en?: string | null
          gender?: string | null
          id?: string
          phone?: string | null
          roster_id?: string | null
          student_code: string
        }
        Update: {
          consumed_at?: string | null
          consumed_by_user_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name_ar?: string
          full_name_en?: string | null
          gender?: string | null
          id?: string
          phone?: string | null
          roster_id?: string | null
          student_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_intents_roster_id_fkey"
            columns: ["roster_id"]
            isOneToOne: false
            referencedRelation: "student_roster"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_requests: {
        Row: {
          auth_user_id: string
          created_at: string
          email: string
          full_name_ar: string
          full_name_en: string | null
          gender: string | null
          id: string
          phone: string | null
          rejection_reason: string | null
          requested_level: number | null
          requested_term: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          roster_id: string | null
          roster_verified: boolean
          status: Database["public"]["Enums"]["account_status"]
          student_code: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          email: string
          full_name_ar: string
          full_name_en?: string | null
          gender?: string | null
          id?: string
          phone?: string | null
          rejection_reason?: string | null
          requested_level?: number | null
          requested_term?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          roster_id?: string | null
          roster_verified?: boolean
          status?: Database["public"]["Enums"]["account_status"]
          student_code: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          email?: string
          full_name_ar?: string
          full_name_en?: string | null
          gender?: string | null
          id?: string
          phone?: string | null
          rejection_reason?: string | null
          requested_level?: number | null
          requested_term?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          roster_id?: string | null
          roster_verified?: boolean
          status?: Database["public"]["Enums"]["account_status"]
          student_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_requests_roster_id_fkey"
            columns: ["roster_id"]
            isOneToOne: false
            referencedRelation: "student_roster"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_overrides: {
        Row: {
          day_of_week: string
          end_time: string
          id: string
          location: string
          scope: string
          slot_id: string
          start_time: string
          student_user_id: string
          updated_at: string
        }
        Insert: {
          day_of_week: string
          end_time: string
          id?: string
          location: string
          scope: string
          slot_id: string
          start_time: string
          student_user_id: string
          updated_at?: string
        }
        Update: {
          day_of_week?: string
          end_time?: string
          id?: string
          location?: string
          scope?: string
          slot_id?: string
          start_time?: string
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_overrides_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      schedule_requests: {
        Row: {
          admin_reply: string | null
          created_at: string
          id: string
          message: string
          reviewed_at: string | null
          status: string
          student_user_id: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message: string
          reviewed_at?: string | null
          status?: string
          student_user_id: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message?: string
          reviewed_at?: string | null
          status?: string
          student_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_requests_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      schedule_slots: {
        Row: {
          created_at: string
          day_of_week: string
          end_time: string
          group_number: number | null
          id: string
          instructor: string | null
          kind: Database["public"]["Enums"]["slot_kind"]
          lab_number: number | null
          location: string
          offering_id: string
          section_number: number | null
          source: string | null
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: string
          end_time: string
          group_number?: number | null
          id?: string
          instructor?: string | null
          kind: Database["public"]["Enums"]["slot_kind"]
          lab_number?: number | null
          location: string
          offering_id: string
          section_number?: number | null
          source?: string | null
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: string
          end_time?: string
          group_number?: number | null
          id?: string
          instructor?: string | null
          kind?: Database["public"]["Enums"]["slot_kind"]
          lab_number?: number | null
          location?: string
          offering_id?: string
          section_number?: number | null
          source?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_slots_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      semester_grade_summaries: {
        Row: {
          created_at: string
          id: string
          is_published: boolean
          semester_gpa: number | null
          semester_id: string
          student_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_published?: boolean
          semester_gpa?: number | null
          semester_id: string
          student_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_published?: boolean
          semester_gpa?: number | null
          semester_id?: string
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "semester_grade_summaries_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semester_grade_summaries_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      semesters: {
        Row: {
          academic_year_id: string
          created_at: string
          ends_on: string | null
          id: string
          is_closed: boolean
          is_current: boolean
          name_ar: string
          season: string
          starts_on: string | null
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          ends_on?: string | null
          id?: string
          is_closed?: boolean
          is_current?: boolean
          name_ar: string
          season: string
          starts_on?: string | null
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          ends_on?: string | null
          id?: string
          is_closed?: boolean
          is_current?: boolean
          name_ar?: string
          season?: string
          starts_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "semesters_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_cleanup_queue: {
        Row: {
          attempts: number
          bucket: string
          created_at: string
          id: string
          last_error: string | null
          reason: string | null
          resolved_at: string | null
          storage_path: string
        }
        Insert: {
          attempts?: number
          bucket: string
          created_at?: string
          id?: string
          last_error?: string | null
          reason?: string | null
          resolved_at?: string | null
          storage_path: string
        }
        Update: {
          attempts?: number
          bucket?: string
          created_at?: string
          id?: string
          last_error?: string | null
          reason?: string | null
          resolved_at?: string | null
          storage_path?: string
        }
        Relationships: []
      }
      student_documents: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          is_available: boolean
          student_user_id: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          is_available?: boolean
          student_user_id: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_available?: boolean
          student_user_id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_documents_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      student_grades: {
        Row: {
          course_id: string
          created_at: string
          grade_letter: string | null
          grade_points: number | null
          id: string
          is_published: boolean
          marks: number | null
          semester_id: string
          status_label: string
          student_user_id: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          grade_letter?: string | null
          grade_points?: number | null
          id?: string
          is_published?: boolean
          marks?: number | null
          semester_id: string
          status_label?: string
          student_user_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          grade_letter?: string | null
          grade_points?: number | null
          id?: string
          is_published?: boolean
          marks?: number | null
          semester_id?: string
          status_label?: string
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_grades_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_grades_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_grades_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          academic_level: string | null
          academic_status: string | null
          academic_year: string | null
          academic_year_id: string | null
          account_status: Database["public"]["Enums"]["account_status"]
          cgpa: number | null
          created_at: string
          earned_hours: number | null
          email: string | null
          extra: Json
          faculty: string | null
          full_name_ar: string
          full_name_en: string | null
          gender: string | null
          level_id: string | null
          national_id: string | null
          phone: string | null
          program: string | null
          program_id: string | null
          student_code: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          academic_level?: string | null
          academic_status?: string | null
          academic_year?: string | null
          academic_year_id?: string | null
          account_status?: Database["public"]["Enums"]["account_status"]
          cgpa?: number | null
          created_at?: string
          earned_hours?: number | null
          email?: string | null
          extra?: Json
          faculty?: string | null
          full_name_ar: string
          full_name_en?: string | null
          gender?: string | null
          level_id?: string | null
          national_id?: string | null
          phone?: string | null
          program?: string | null
          program_id?: string | null
          student_code?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          academic_level?: string | null
          academic_status?: string | null
          academic_year?: string | null
          academic_year_id?: string | null
          account_status?: Database["public"]["Enums"]["account_status"]
          cgpa?: number | null
          created_at?: string
          earned_hours?: number | null
          email?: string | null
          extra?: Json
          faculty?: string | null
          full_name_ar?: string
          full_name_en?: string | null
          gender?: string | null
          level_id?: string | null
          national_id?: string | null
          phone?: string | null
          program?: string | null
          program_id?: string | null
          student_code?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "academic_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "academic_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      student_roster: {
        Row: {
          approved_email: string
          created_at: string
          full_name_ar: string | null
          full_name_en: string | null
          id: string
          is_active: boolean
          level_id: string | null
          program_id: string | null
          student_code: string
          updated_at: string
        }
        Insert: {
          approved_email: string
          created_at?: string
          full_name_ar?: string | null
          full_name_en?: string | null
          id?: string
          is_active?: boolean
          level_id?: string | null
          program_id?: string | null
          student_code: string
          updated_at?: string
        }
        Update: {
          approved_email?: string
          created_at?: string
          full_name_ar?: string | null
          full_name_en?: string | null
          id?: string
          is_active?: boolean
          level_id?: string | null
          program_id?: string | null
          student_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_roster_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "academic_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_roster_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "academic_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_approve_registration_atomic: {
        Args: {
          _academic_year_id?: string | null
          _actor_label: string
          _actor_user_id: string
          _level_id?: string | null
          _program_id?: string | null
          _request_id: string
        }
        Returns: Json
      }
      admin_reject_registration_atomic: {
        Args: {
          _actor_label: string
          _actor_user_id: string
          _reason?: string | null
          _request_id: string
        }
        Returns: Json
      }
      admin_set_account_status_atomic: {
        Args: {
          _actor_label: string
          _actor_user_id: string
          _new_status: Database["public"]["Enums"]["account_status"]
          _reason?: string | null
          _target_user_id: string
        }
        Returns: Json
      }
      admin_upsert_academic_year_atomic: {
        Args: {
          _actor_label: string
          _actor_user_id: string
          _id: string | null
          _is_current: boolean
          _name: string
        }
        Returns: {
          created_at: string
          id: string
          is_current: boolean
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "academic_years"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_upsert_semester_atomic: {
        Args: {
          _academic_year_id: string
          _actor_label: string
          _actor_user_id: string
          _id: string | null
          _is_closed: boolean
          _is_current: boolean
          _name_ar: string
          _season: string
        }
        Returns: {
          academic_year_id: string
          created_at: string
          ends_on: string | null
          id: string
          is_closed: boolean
          is_current: boolean
          name_ar: string
          season: string
          starts_on: string | null
        }
        SetofOptions: {
          from: "*"
          to: "semesters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_student_plan: {
        Args: {
          p_actor: string
          p_courses: string[]
          p_group: number
          p_lab: number
          p_level: string
          p_section: number
          p_semester: string
          p_student: string
        }
        Returns: undefined
      }
      can_access_audience: {
        Args: {
          _audience: Database["public"]["Enums"]["document_audience"]
          _level_id: string
          _program_id: string
          _target_student_user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_student: { Args: never; Returns: boolean }
      resolve_login_email: { Args: { p_identifier: string }; Returns: string }
    }
    Enums: {
      account_status: "pending" | "active" | "rejected" | "suspended"
      app_role: "admin" | "student"
      document_audience: "all" | "program" | "level" | "student"
      event_kind: "exam" | "deadline" | "academic" | "announcement"
      slot_kind: "lecture" | "section" | "lab"
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
      account_status: ["pending", "active", "rejected", "suspended"],
      app_role: ["admin", "student"],
      document_audience: ["all", "program", "level", "student"],
      event_kind: ["exam", "deadline", "academic", "announcement"],
      slot_kind: ["lecture", "section", "lab"],
    },
  },
} as const

