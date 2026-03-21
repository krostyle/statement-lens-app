"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, Plus, Tag } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/src/components/ui/dialog";
import { CategoryForm } from "./category-form";
import { Skeleton } from "@/src/components/ui/skeleton";
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
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryResponseDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryResponseDTO | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/categories");
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setCategories(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    setDeleteError("");
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    setDeleteTarget(null);
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
          key={editing?.id ?? 'new'}
          category={editing}
          onSuccess={(updated) => {
            setOpen(false);
            if (editing) {
              setCategories((prev) => prev.map((c) => c.id === updated.id ? updated : c));
            } else {
              setCategories((prev) => [...prev, updated]);
            }
          }}
          onCancel={() => setOpen(false)}
        />
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar categoría</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 py-2">
            ¿Estás seguro que deseas eliminar «{deleteTarget?.name}»? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget.id)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading && Array.from({ length: 6 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4">
            <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
            <Skeleton className="h-4 w-28 flex-1" />
            <Skeleton className="h-7 w-16 rounded-md" />
          </div>
        ))}
        {!loading && categories.map((c) => (
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
                onClick={() => setDeleteTarget(c)}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
        {!loading && categories.length === 0 && (
          <p className="col-span-3 py-8 text-center text-zinc-400">
            Sin categorías
          </p>
        )}
      </div>
    </div>
  );
}
