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

import { useMemo } from "react";

function StoryFavoritesPage({ onNotice }: { onNotice?: (msg: string) => void }) {
    const [favorites, setFavorites] = useState<StoryFavorite[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadStoryFavorites()
            .then(data => {
                setFavorites(data.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("确定要删除这条收藏吗？")) return;
        await deleteStoryFavorite(id);
        setFavorites(prev => prev.filter(item => item.id !== id));
        if (onNotice) {
            onNotice("已取消收藏");
        } else {
            alert("已取消收藏");
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getLocalDateStr = (iso: string) => {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return "未知日期";
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    };

    const stripThinkingAndTags = (text: string): string => {
        if (!text) return "";
        let clean = text;

        // 1. Remove XML-style think/thinking/thought/reasoning/summary tags and their contents (supporting unclosed tags)
        const tagsToRemove = ["think", "thinking", "thought", "reasoning", "summary"];
        for (const tag of tagsToRemove) {
            const rx = new RegExp(`<${tag}>[\\s\\S]*?(<\\/${tag}>|$)`, "gi");
            clean = clean.replace(rx, "");
        }

        // 2. Remove common text patterns of thinking blocks (supporting unclosed blocks)
        clean = clean.replace(/【思考】[\s\S]*?(【\/思考】|$)/gi, "");
        clean = clean.replace(/\[Thinking\][\s\S]*?(\[\/Thinking\]|$)/gi, "");
        clean = clean.replace(/\[thought\][\s\S]*?(\[\/thought\]|$)/gi, "");
        clean = clean.replace(/\[思考\][\s\S]*?(\[\/思考\]|$)/gi, "");
        
        // Remove lines starting with "Thinking Process:", "思考过程：", etc. (supporting multiline block to the end)
        clean = clean.replace(/^(Thinking Process|Thinking|思考过程|思考|思维链)[：:][\s\S]*?(\n\n|$)/gi, "");

        // 3. Remove comments of fold blocks: <!--RHR-FOLD:xxx-->...<!--/RHR-FOLD--> (supporting unclosed comment blocks)
        clean = clean.replace(/<!--RHR-FOLD:[\s\S]*?-->[\s\S]*?(<!--\/RHR-FOLD-->|$)/gi, "");

        // 4. Remove any remaining HTML tags
        clean = clean.replace(/<[^>]+>/g, "");

        return clean.replace(/\s*\n\s*\n\s*/g, "\n\n").trim();
    };

    // Group favorites by date
    const groupedFavorites = useMemo(() => {
        const groups: { [dateStr: string]: StoryFavorite[] } = {};
        favorites.forEach(fav => {
            const dStr = getLocalDateStr(fav.createdAt);
            if (!groups[dStr]) groups[dStr] = [];
            groups[dStr].push(fav);
        });
        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    }, [favorites]);

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

    return (
        <div className="p-4 flex flex-col gap-6">
            {groupedFavorites.map(([dateStr, items]) => (
                <div key={dateStr} className="flex flex-col gap-3">
                    {/* Date Section Header */}
                    <div className="flex items-center gap-2">
                        <div className="h-[1px] flex-1 bg-neutral-100" />
                        <span className="text-xs font-medium text-neutral-400 px-2 bg-neutral-50 rounded-full border border-neutral-100">
                            {dateStr}
                        </span>
                        <div className="h-[1px] flex-1 bg-neutral-100" />
                    </div>

                    {/* Favorites of this date */}
                    <div className="flex flex-col gap-2">
                        {items.map((fav) => {
                            const isExpanded = expandedIds[fav.id];
                            return (
                                <div
                                    key={fav.id}
                                    onClick={() => toggleExpand(fav.id)}
                                    className="rounded-xl bg-white border border-neutral-100 shadow-sm flex flex-col overflow-hidden cursor-pointer hover:border-pink-200 transition-colors"
                                >
                                    {/* Header Row (Always visible) */}
                                    <div className="p-3 flex justify-between items-center gap-4">
                                        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                                            <span className="text-xs font-semibold px-2 py-0.5 bg-pink-50 text-pink-600 rounded-full max-w-[124px] truncate">
                                                {fav.annotation}
                                            </span>
                                            <span className="text-xs text-neutral-500 font-medium truncate">
                                                角色：{fav.characterName}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <button
                                                onClick={(e) => handleDelete(fav.id, e)}
                                                className="p-1.5 hover:bg-red-50 text-neutral-400 hover:text-red-500 rounded-lg transition-colors"
                                                title="删除收藏"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                            <svg
                                                className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth="2.5"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Collapsible Content */}
                                    {isExpanded && (
                                        <div className="px-3 pb-3 border-t border-neutral-50 bg-neutral-50/50">
                                            <div className="mt-3 text-sm text-neutral-700 bg-white p-3 rounded-lg border border-neutral-100 whitespace-pre-wrap leading-relaxed">
                                                {stripThinkingAndTags(fav.rawContent)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
