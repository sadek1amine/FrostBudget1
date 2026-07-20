"use client";

import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatterLeMontant } from "@/lib/utils";
import { 
  CloudSnow, 
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Snowflake
} from "lucide-react";
import { 
  getUserBudgets, 
  getUserCashOnHand, 
  updateBudgetAmounts, 
  updateCashOnHand 
} from "@/lib/actions/user.actions";

interface MonthlyBudget {
  $id: string;
  userId: string;
  categoryId: string;
  categoryName: string; 
  allocatedAmount: number; 
  activityAmount: number; 
  month_year: string;
}

interface UserCashOnHand {
  $id: string;
  userId: string;
  toBeBudgeted: number; 
}

interface RecentBudgetsProps {
  userId: string;
}

const RecentBudgets: React.FC<RecentBudgetsProps> = ({ userId }) => {
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [cashOnHand, setCashOnHand] = useState<UserCashOnHand | null>(null);
  const [loading, setLoading] = useState(true);

  // Blizzard Realignment Modals States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetBudget, setTargetBudget] = useState<MonthlyBudget | null>(null);
  const [sourceBudgetId, setSourceBudgetId] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<string>("");

  const [newAllocated, setNewAllocated] = useState({
    categoryId: '',
    categoryName: '',
    amount: ''
  });

  const availableCategories = [
    { id: "cat_1", name: "Alimentation & Courses" },
    { id: "cat_2", name: "Logement & Factures" },
    { id: "cat_3", name: "Loisirs & Sorties" },
    { id: "cat_4", name: "Santé & Urgences" },
    { id: "cat_5", name: "Abonnements & Services" }
  ];

  const loadBudgetData = async () => {
    setLoading(true);
    try {
      const dbBudgets = await getUserBudgets(userId);
      const dbCash = await getUserCashOnHand(userId);

      if (dbCash) {
        setCashOnHand(dbCash as any);
      } else {
        setCashOnHand({ $id: "temp_cash", userId, toBeBudgeted: 500 });
      }

      if (dbBudgets && dbBudgets.length > 0) {
        setBudgets(dbBudgets as any);
      } else {
        setBudgets([
          { $id: "b_1", userId, categoryId: "cat_1", categoryName: "Alimentation & Courses", allocatedAmount: 200, activityAmount: 260, month_year: "2026-07" },
          { $id: "b_2", userId, categoryId: "cat_2", categoryName: "Logement & Factures", allocatedAmount: 800, activityAmount: 800, month_year: "2026-07" },
          { $id: "b_3", userId, categoryId: "cat_3", categoryName: "Loisirs & Sorties", allocatedAmount: 150, activityAmount: 30, month_year: "2026-07" }
        ]);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données budgétaires :", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) loadBudgetData();
  }, [userId]);

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountToAllocate = Number(newAllocated.amount);

    if (!newAllocated.categoryId || amountToAllocate <= 0 || !cashOnHand) return;
    if (amountToAllocate > cashOnHand.toBeBudgeted) {
      alert("Solde insuffisant dans votre Glacière Financière !");
      return;
    }

    const selectedCat = availableCategories.find(c => c.id === newAllocated.categoryId);
    if (!selectedCat) return;

    const existingIndex = budgets.findIndex(b => b.categoryId === selectedCat.id);
    const updatedBudgets = [...budgets];

    if (existingIndex > -1) {
      updatedBudgets[existingIndex].allocatedAmount += amountToAllocate;
      if (cashOnHand.$id !== "temp_cash") {
        await updateBudgetAmounts(updatedBudgets[existingIndex].$id, updatedBudgets[existingIndex].allocatedAmount);
      }
    } else {
      const newBudgetObj = {
        $id: `b_${Date.now()}`,
        userId,
        categoryId: selectedCat.id,
        categoryName: selectedCat.name,
        allocatedAmount: amountToAllocate,
        activityAmount: 0,
        month_year: "2026-07"
      };
      updatedBudgets.push(newBudgetObj);
    }

    const newCashBalance = cashOnHand.toBeBudgeted - amountToAllocate;
    setBudgets(updatedBudgets);
    setCashOnHand({ ...cashOnHand, toBeBudgeted: newCashBalance });

    if (cashOnHand.$id !== "temp_cash") {
      await updateCashOnHand(cashOnHand.$id, newCashBalance);
    }

    setNewAllocated({ categoryId: '', categoryName: '', amount: '' });
  };

  const executeRealignment = async () => {
    const amount = Number(transferAmount);
    if (!targetBudget || !sourceBudgetId || amount <= 0) return;

    const sourceIndex = budgets.findIndex(b => b.$id === sourceBudgetId);
    const targetIndex = budgets.findIndex(b => b.$id === targetBudget.$id);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const source = budgets[sourceIndex];
    const sourceAvailable = source.allocatedAmount - source.activityAmount;

    if (amount > sourceAvailable) {
      alert("Le montant à transférer dépasse l'excédent disponible dans cette catégorie !");
      return;
    }

    const updated = [...budgets];
    updated[sourceIndex].allocatedAmount -= amount;
    updated[targetIndex].allocatedAmount += amount;

    setBudgets(updated);

    if (source.$id.startsWith('b_') && !source.$id.includes('temp')) {
      await updateBudgetAmounts(updated[sourceIndex].$id, updated[sourceIndex].allocatedAmount);
      await updateBudgetAmounts(updated[targetIndex].$id, updated[targetIndex].allocatedAmount);
    }

    setIsModalOpen(false);
    setTargetBudget(null);
    setTransferAmount("");
    setSourceBudgetId("");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12 gap-2 text-cyan-600">
        <CloudSnow className="animate-spin w-6 h-6" />
        <span className="text-sm font-medium">Mise à jour de la Glacière Financière...</span>
      </div>
    );
  }

  const iceboxValue = cashOnHand?.toBeBudgeted || 0;

  return (
    <div className="space-y-6" dir="ltr">
      
      {/* 🧊 La Glacière Financière */}
      <div className={`p-6 rounded-2xl border transition-all duration-300 shadow-md ${
        iceboxValue > 0 
          ? "bg-cyan-50 border-cyan-200 text-cyan-900 animate-pulse" 
          : "bg-emerald-50 border-emerald-200 text-emerald-900"
      }`}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-xl font-bold flex items-center justify-center md:justify-start gap-2">
              <Snowflake className="w-6 h-6 text-cyan-600" />
              <span>Glacière Financière (Argent Liquide)</span>
            </h2>
            <p className="text-sm opacity-80">
              {iceboxValue > 0 
                ? "Vous avez des fonds non alloués ! Distribuez ce montant dans vos catégories pour affecter chaque euro disponible (Objectif Zéro)."
                : "Excellent travail ! Votre budget est entièrement alloué et vos blocs financiers sont stables."}
            </p>
          </div>
          <div className="bg-white/90 backdrop-blur px-6 py-3 rounded-xl border border-cyan-100 shadow-inner flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500">Reste à budgétiser :</span>
            <span className={`text-2xl font-black ${iceboxValue > 0 ? "text-cyan-600" : "text-emerald-600"}`}>
              {formatterLeMontant(iceboxValue)}
            </span>
          </div>
        </div>
      </div>

      {/* 📊 Tableau des Budgets */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-gray-700 text-base">Vue d'ensemble des Catégories</h3>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100/50">
              <TableHead className="text-left">Catégorie</TableHead>
              <TableHead className="text-right">Budget Alloué</TableHead>
              <TableHead className="text-right">Dépenses Réelles</TableHead>
              <TableHead className="text-right">Solde Disponible</TableHead>
              <TableHead className="text-center">Statut du Flux</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {budgets.map((b) => {
              const available = b.allocatedAmount - b.activityAmount;
              const isOverspent = available < 0;

              return (
                <TableRow 
                  key={b.$id} 
                  className={`transition-colors cursor-pointer ${
                    isOverspent ? "bg-red-50/70 hover:bg-red-50 text-red-900 font-medium" : "hover:bg-gray-50/80"
                  }`}
                  onClick={() => {
                    if (isOverspent) {
                      setTargetBudget(b);
                      setIsModalOpen(true);
                    }
                  }}
                >
                  <TableCell className="font-semibold p-4 flex items-center gap-2">
                    {isOverspent && <CloudSnow className="w-4 h-4 text-red-500 animate-spin" />}
                    {b.categoryName}
                  </TableCell>
                  <TableCell className="text-right font-mono p-4 text-blue-600">
                    {formatterLeMontant(b.allocatedAmount)}
                  </TableCell>
                  <TableCell className="text-right font-mono p-4 text-gray-600">
                    {formatterLeMontant(b.activityAmount)}
                  </TableCell>
                  <TableCell className={`text-right font-mono p-4 font-bold ${isOverspent ? "text-red-600" : "text-emerald-600"}`}>
                    {formatterLeMontant(available)}
                  </TableCell>
                  <TableCell className="p-4 text-center">
                    {isOverspent ? (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTargetBudget(b);
                          setIsModalOpen(true);
                        }}
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-xs"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 mr-1 inline" />
                        Alerte Blizzard - Ajuster 🌬️
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium border border-emerald-200">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        Stable & Figé
                      </span>
                      
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* ➕ Allocation depuis l'Icebox */}
      {iceboxValue > 0 && (
        <div className="bg-white p-6 rounded-2xl border shadow-sm max-w-md mx-auto">
          <h4 className="font-bold text-gray-800 mb-3 text-center">Allouer des fonds depuis l'Icebox 🧊</h4>
          <form onSubmit={handleAllocate} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Catégorie Cible</label>
              <select
                value={newAllocated.categoryId}
                onChange={(e) => setNewAllocated({ ...newAllocated, categoryId: e.target.value })}
                className="w-full border rounded-lg p-2 text-sm bg-white"
                required
              >
                <option value="">Sélectionnez une catégorie...</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Montant à injecter (€)</label>
              <Input
                type="number"
                placeholder="Entrez le montant"
                value={newAllocated.amount}
                onChange={(e) => setNewAllocated({ ...newAllocated, amount: e.target.value })}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold">
              Confirmer l'allocation
            </Button>
          </form>
        </div>
      )}

      {/* 🌬️ Modale de Réalignement */}
      {isModalOpen && targetBudget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl relative mx-4 border border-red-100">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-2">
              <span>🌬️ Réalignement Budgétaire Interactif (Blizzard)</span>
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              La catégorie <strong className="text-red-600">{targetBudget.categoryName}</strong> a dépassé ses limites. Piochez dans les excédents d'une catégorie stable pour équilibrer le flux.
            </p>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Prendre les fonds depuis :</label>
                <select
                  value={sourceBudgetId}
                  onChange={(e) => setSourceBudgetId(e.target.value)}
                  className="w-full border rounded-lg p-2 text-sm bg-white"
                >
                  <option value="">Sélectionnez une catégorie avec excédent...</option>
                  {budgets
                    .filter(b => b.$id !== targetBudget.$id && (b.allocatedAmount - b.activityAmount) > 0)
                    .map((b) => (
                      <option key={b.$id} value={b.$id}>
                        {b.categoryName} (Excédent : {formatterLeMontant(b.allocatedAmount - b.activityAmount)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Montant à transférer :</label>
                <Input
                  type="number"
                  placeholder="Montant requis"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setTargetBudget(null);
                    setTransferAmount("");
                    setSourceBudgetId("");
                  }} 
                  variant="outline" 
                  className="w-full text-gray-600"
                >
                  Annuler
                </Button>
                <Button 
                  onClick={executeRealignment}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  Confirmer le transfert
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RecentBudgets;
