"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, Plus, Tag } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Dialog } from "@/src/components/ui/dialog";
import { CategoryForm } from "./category-form";
import type { CategoryResponseDTO } from "@/src/application/dtos/category.dto";

function translateApiError(raw: string | undefined): string {
  switch (raw) {
    case "Category not found":       return "Categoría no encontrada.";
    case "Forbidden":                return "No tienes permiso para realizar esta acción.";
    case "Category with this name already exists": return "Ya existe una categoría con ese nombre.";
    default:                         return raw ?? "Ocurrió un error inesperado.";
  }
}

export function CategoriesView() {
  const [categories, setCategories] = useState<CategoryResponseDTO[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryResponseDTO | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const load = async () => {
    const res = await fetch("/api/categories");
    if (!res.ok) return;
    const data = await res.json();
    setCategories(Array.isArray(data) ? data : []);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar categoría?")) return;
    setDeleteError("");
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (res.ok) {
      load();
    } else {
      const j = await res.json().catch(() => ({}));
      setDeleteError(translateApiError(j?.error));
    }
  };

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (c: CategoryResponseDTO) => { setEditing(c); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nueva categoría
        </Button>
      </div>

      {deleteError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {deleteError}
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <CategoryForm
          category={editing}
          onSuccess={() => { setOpen(false); load(); }}
          onCancel={() => setOpen(false)}
        />
      </Dialog>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4"
          >
            <div className="h-9 w-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
              <Tag className="h-4 w-4 text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-zinc-900 truncate">{c.name}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(c.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
        {categories.length === 0 && (
          <p className="col-span-3 py-8 text-center text-zinc-400">
            Sin categorías
          </p>
        )}
      </div>
    </div>
  );
}
