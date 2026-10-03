import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { legal } from "@/config/legal";

export async function hasAcceptedCurrentLegal(supabase: SupabaseClient) {
  const { data } = await supabase.from("consent_records").select("document").eq("version", legal.version);
  const docs = new Set((data ?? []).map((r) => r.document));
  return docs.has("terminos") && docs.has("privacidad");
}

export type CatalogItem = { id: string; kind: "level" | "grade" | "area"; name: string; sort_order: number };
export type TerritoryItem = { id: string; kind: "region" | "ugel"; name: string; parent_id: string | null; is_synthetic: boolean };

// Reference data and the viewer's own choices for onboarding and the profile page.
export async function loadProfileContext(supabase: SupabaseClient, countryCode: string | null) {
  const country = countryCode ?? "PE";
  const [countries, territory, catalog, relations, selections] = await Promise.all([
    supabase.from("countries").select("code, name").eq("active", true).order("name"),
    supabase.from("territory_units").select("id, kind, name, parent_id, is_synthetic").eq("country_code", country).eq("active", true).order("name"),
    supabase.from("education_catalog").select("id, kind, name, sort_order").eq("country_code", country).eq("active", true).order("sort_order"),
    supabase.from("education_catalog_relations").select("from_id, to_id"),
    supabase.from("profile_education_selections").select("catalog_id"),
  ]);
  return {
    countries: (countries.data ?? []) as { code: string; name: string }[],
    territory: (territory.data ?? []) as TerritoryItem[],
    catalog: (catalog.data ?? []) as CatalogItem[],
    relations: (relations.data ?? []) as { from_id: string; to_id: string }[],
    selected: (selections.data ?? []).map((s) => s.catalog_id as string),
  };
}
