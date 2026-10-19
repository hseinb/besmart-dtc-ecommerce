"use client";

import React from "react";
import { Home, LayoutGrid, Zap, ShoppingBag, User } from "lucide-react";
import { useSmartNavStore, SmartMainTab } from "@/store/useSmartNavStore";

interface SmartBottomNavProps {
  bagCount?: number;
}

export function SmartBottomNav({ bagCount = 0 }: SmartBottomNavProps) {
  const { activeTab, setActiveTab, setOnSaleOnly, navigateToDeals } =
    useSmartNavStore();

  const navItems: {
    id: SmartMainTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    isDeals?: boolean;
    badge?: number;
  }[] = [
    { id: "home", label: "Shop", icon: Home },
    { id: "categories", label: "Categories", icon: LayoutGrid },
    { id: "deals", label: "Deals", icon: Zap, isDeals: true },
    { id: "bag", label: "Bag", icon: ShoppingBag, badge: bagCount },
    { id: "me", label: "Me", icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
      <div className="grid grid-cols-5 h-14">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.isDeals) {
                  navigateToDeals();
                } else {
                  if (item.id === "home") setOnSaleOnly(false);
                  setActiveTab(item.id);
                }
              }}
              className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                isActive
                  ? item.isDeals
                    ? "text-smart-sale font-extrabold"
                    : "text-smart-teal font-extrabold"
                  : "text-slate-500 hover:text-slate-800 font-semibold"
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? "scale-110" : ""
                  } ${item.isDeals && isActive ? "fill-smart-sale" : ""}`}
                />
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-smart-gold text-slate-950 text-[10px] font-black flex items-center justify-center shadow-xs tabular-numbers">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight">{item.label}</span>
              {isActive && (
                <span
                  className={`absolute top-0 w-8 h-0.5 rounded-full ${
                    item.isDeals ? "bg-smart-sale" : "bg-smart-teal"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
