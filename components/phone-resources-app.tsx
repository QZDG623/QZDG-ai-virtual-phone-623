"use client";

import { useEffect, useState } from "react";
import { Brain, Bookmark, MoreHorizontal, Sparkles, Trash2 } from "lucide-react";
import { MemoryBankPage } from "./memory/memory-bank-page";
import { VnAssetPage } from "./vn/vn-asset-page";
import { loadCharacters } from "@/lib/character-storage";
import { PageShell } from "./ui/page-shell";
import { FeaturedCard, type FeaturedCardItem } from "./ui/card-grid";
import { BINDING_ACCENTS, CONTENT_APP_ACCENTS } from "@/lib/ui-accent-colors";
import { loadStoryFavorites, deleteStoryFavorite, type StoryFavorite } from "@/lib/story-storage";

export type ResourceSubPage = "main" | "memory" | "vn_assets" | "story_favorites";
type MemoryView = "list" | "detail" | "settings";

const RESOURCE_MENU: Omit<FeaturedCardItem, "onClick">[] = [
    {
        id: "memory",
        icon: Brain,
        label: "记忆库",
        desc: "角色记忆档案",
        iconColor: BINDING_ACCENTS.memory,
        glassIcon: "memory",
    },
    {
        id: "vn_assets",
        icon: Sparkles,
        label: "漫卷资源",
        desc: "场景与角色立绘",
        iconColor: CONTENT_APP_ACCENTS.vn,
        glassIcon: "vn-assets",
    },
    {
        id: "story_favorites",
        icon: Bookmark,
        label: "剧情收藏",
        desc: "已收藏的剧情对话片段",
        iconColor: "#ec4899",
        glassIcon: "story-favorites",
    },
];

export function PhoneResourcesApp({ onClose, onNotice, initialPage }: { onClose: () => void; onNotice?: (msg: string) => void; initialPage?: ResourceSubPage }) {
    const [currentPage, setCurrentPage] = useState<ResourceSubPage>(initialPage ?? "main");
    const [memoryView, setMemoryView] = useState<MemoryView>("list");
    const [prevMemoryView, setPrevMemoryView] = useState<MemoryView>("list");
    const [memoryCharId, setMemoryCharId] = useState<string>("");
    const [memoryCharName, setMemoryCharName] = useState<string>("");

    useEffect(() => {
        if (initialPage) setCurrentPage(initialPage);
    }, [initialPage]);

    const handleBack = () => {
        if (currentPage === "memory") {
            if (memoryView === "settings") {
                setMemoryView(prevMemoryView);
            } else if (memoryView === "detail") {
                setMemoryView("list");
            } else {
                setCurrentPage("main");
                setMemoryView("list");
                setMemoryCharId("");
                setMemoryCharName("");
            }
        } else if (currentPage === "vn_assets") {
            setCurrentPage("main");
        } else if (currentPage !== "main") {
            setCurrentPage("main");
        } else {
            onClose();
        }
    };

    const handleSelectChar = (charId: string) => {
        const chars = loadCharacters();
        const char = chars.find(c => c.id === charId);
        setMemoryCharId(charId);
        setMemoryCharName(char?.name ?? "");
        setMemoryView("detail");
    };

    const title = currentPage === "main" ? "资源库"
        : currentPage === "memory"
            ? (memoryView === "settings" ? "记忆设置"
                : memoryView === "detail" ? (memoryCharName || "记忆详情")
                    : "记忆库")
            : currentPage === "vn_assets" ? "漫卷资源"
                : currentPage === "story_favorites" ? "剧情收藏"
                    : "资源库";

    const showSettingsIcon = currentPage === "memory" && memoryView !== "settings";

    return (
        <PageShell
            title={title}
            onBack={handleBack}
            className={currentPage === "memory" && memoryView === "detail" ? "mem-detail" : undefined}
            rightAction={showSettingsIcon ? (
                <button
                    onClick={() => { setPrevMemoryView(memoryView); setMemoryView("settings"); }}
                    className="page-back-btn"
                    type="button"
                    aria-label="更多"
                >
                    <MoreHorizontal size={22} strokeWidth={1.5} />
                </button>
            ) : undefined}
        >
            <div
                className="flex-1 relative"
                style={{
                    overflowY: currentPage === "memory" && memoryView === "detail" ? "hidden" : "auto"
                }}
            >
                {currentPage === "main" && (
                    <div className="page-menu">
                        <div>
                            <h3 className="settings-menu-section-title">Resources</h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
                                {RESOURCE_MENU.map((item) => (
                                    <FeaturedCard
                                        key={item.id}
                                        item={{
                                            ...item,
                                            onClick: () => setCurrentPage(item.id as ResourceSubPage),
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {currentPage === "vn_assets" && (
                    <VnAssetPage onNotice={onNotice} />
                )}

                {currentPage === "memory" && (
                    <MemoryBankPage
                        view={memoryView}
                        selectedCharId={memoryCharId}
                        onSelectChar={handleSelectChar}
                        onNotice={onNotice}
                    />
                )}

                {currentPage === "story_favorites" && (
                    <StoryFavoritesPage onNotice={onNotice} />
                )}
            </div>
        </PageShell>
    );
}

function StoryFavoritesPage({ onNotice }: { onNotice?: (msg: string) => void }) {
    const [favorites, setFavorites] = useState<StoryFavorite[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStoryFavorites()
            .then(data => {
                setFavorites(data.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("确定要删除这条收藏吗？")) return;
        await deleteStoryFavorite(id);
        setFavorites(prev => prev.filter(item => item.id !== id));
        if (onNotice) {
            onNotice("已取消收藏");
        } else {
            alert("已取消收藏");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 text-neutral-400 text-sm">
                加载中...
            </div>
        );
    }

    if (favorites.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-neutral-400">
                <Bookmark className="w-12 h-12 opacity-30 mb-3 text-neutral-300" />
                <p className="text-sm font-medium">还没有任何剧情收藏</p>
                <p className="text-xs opacity-70 mt-1">在剧情聊天中长按或右键消息即可添加收藏</p>
            </div>
        );
    }

    const stripThinkingAndTags = (text: string): string => {
        if (!text) return "";
        let clean = text;
        const tagsToRemove = ["think", "thinking", "reasoning", "summary"];
        for (const tag of tagsToRemove) {
            const rx = new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, "gi");
            clean = clean.replace(rx, "");
        }
        clean = clean.replace(/<!--RHR-FOLD:[\s\S]*?-->[\s\S]*?<!--\/RHR-FOLD-->/gi, "");
        clean = clean.replace(/<[^>]+>/g, "");
        return clean.replace(/\s*\n\s*\n\s*/g, "\n\n").trim();
    };

    return (
        <div className="p-4 flex flex-col gap-4">
            {favorites.map((fav) => (
                <div
                    key={fav.id}
                    className="p-4 rounded-xl bg-white border border-neutral-100 shadow-sm flex flex-col gap-3 relative group"
                >
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold px-2 py-0.5 bg-pink-50 text-pink-600 rounded-full w-fit">
                                {fav.annotation}
                            </span>
                            <span className="text-xs text-neutral-400">
                                角色：{fav.characterName} • {new Date(fav.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                        <button
                            onClick={() => handleDelete(fav.id)}
                            className="p-1.5 hover:bg-red-50 text-neutral-400 hover:text-red-500 rounded-lg transition-colors"
                            title="删除收藏"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                    <div className="text-sm text-neutral-700 bg-neutral-50 p-3 rounded-lg border border-neutral-100 whitespace-pre-wrap leading-relaxed">
                        {stripThinkingAndTags(fav.rawContent)}
                    </div>
                </div>
            ))}
        </div>
    );
}
