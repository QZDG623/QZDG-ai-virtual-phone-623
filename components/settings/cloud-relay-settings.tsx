"use client";

import { useState, useEffect } from "react";
import { Toggle } from "../ui/form";

export function CloudRelaySettingsSection({ onNotice }: { onNotice: (msg: string) => void }) {
    const [enableCloudRelay, setEnableCloudRelay] = useState(false);
    const [cloudRelayUrl, setCloudRelayUrl] = useState("");
    const [cloudRelaySecret, setCloudRelaySecret] = useState("");
    const [status, setStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

    useEffect(() => {
        const savedEnable = localStorage.getItem("enableCloudRelay") === "true";
        const savedUrl = localStorage.getItem("cloudRelayUrl") || "";
        const savedSecret = localStorage.getItem("cloudRelaySecret") || "";
        setEnableCloudRelay(savedEnable);
        setCloudRelayUrl(savedUrl);
        setCloudRelaySecret(savedSecret);
    }, []);

    const handleSave = (key: string, value: any) => {
        localStorage.setItem(key, String(value));
        if (key === "enableCloudRelay") setEnableCloudRelay(value);
        if (key === "cloudRelayUrl") setCloudRelayUrl(value);
        if (key === "cloudRelaySecret") setCloudRelaySecret(value);
    };

    const testConnection = async () => {
        if (!cloudRelayUrl) {
            onNotice("请输入中继地址");
            return;
        }
        setStatus("testing");
        try {
            // 1. 请求系统通知权限
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                throw new Error("未授予通知权限，无法启用云端推送");
            }

            // 2. 获取 Service Worker 注册对象并订阅 Web Push
            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                // 默认公钥，实际可从中继获取或配置。此处先尝试直接订阅
                // 真正的 VAPID public key 应当由 Cloudflare Worker 提供。
                // 我们在 Worker 里写一个 /api/vapid-public-key 端点让前端获取，或者允许不带 applicationServerKey（有些中转通道支持）
                let vapidKey = "";
                try {
                    const keyRes = await fetch(`${cloudRelayUrl.replace(/\/$/, "")}/api/vapid-public-key`, {
                        headers: { "Authorization": `Bearer ${cloudRelaySecret}` }
                    });
                    if (keyRes.ok) {
                        const keyData = await keyRes.json();
                        vapidKey = keyData.publicKey;
                    }
                } catch (e) {
                    console.warn("无法从云端自动获取 VAPID 密钥，尝试直接订阅", e);
                }

                const subscribeOptions: PushSubscriptionOptionsInit = {
                    userVisibleOnly: true,
                };
                if (vapidKey) {
                    subscribeOptions.applicationServerKey = vapidKey;
                }

                subscription = await registration.pushManager.subscribe(subscribeOptions);
            }

            // 3. 将订阅信息发送到 Cloudflare 中继服务器
            const res = await fetch(`${cloudRelayUrl.replace(/\/$/, "")}/api/subscribe`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${cloudRelaySecret}`
                },
                body: JSON.stringify({ subscription, userId: "default" })
            });

            if (!res.ok) throw new Error("中继服务器注册失败");

            setStatus("success");
            handleSave("enableCloudRelay", true);
            onNotice("云端中继推送配置成功！");
        } catch (err: any) {
            console.error(err);
            setStatus("error");
            onNotice(`连接失败: ${err.message}`);
        }
    };

    return (
        <div className="app-card card-featured flex-col gap-3 p-4 bg-gray-50 dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-850 mt-2">
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-2.5">
                    {/* 绿色的精致云朵图标 */}
                    <span className="text-emerald-500 flex shrink-0 items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.48 0-.96.06-1.4.17A5.5 5.5 0 0 0 5 13c0 2.2 1.8 4 4 4" fill="#10b981" fillOpacity="0.15" stroke="#10b981" strokeWidth="2" />
                            <path d="M15 11.5A4.5 4.5 0 0 0 6.5 13a3.5 3.5 0 0 0 0 6H15a4.5 4.5 0 0 0 0-9z" fill="#10b981" fillOpacity="0.2" stroke="#059669" strokeWidth="1.5" />
                        </svg>
                    </span>
                    <div className="flex flex-col">
                        <span className="card-featured-label text-sm font-semibold text-gray-800 dark:text-gray-200">云端中继推送</span>
                        <span className="card-featured-desc text-xs text-gray-500 dark:text-gray-400">利用 Cloudflare 离线推送，彻底解决后台锁屏收不到弹窗问题</span>
                    </div>
                </div>

                <Toggle checked={enableCloudRelay} onChange={(v) => handleSave("enableCloudRelay", v)} className="settings-toggle-control" />
            </div>

            {enableCloudRelay && (
                <div className="w-full space-y-3 pt-2.5 border-t border-gray-100 dark:border-zinc-805 animate-fadeIn">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                            中继服务器地址 (Cloudflare Worker URL)
                        </label>
                        <input
                            type="text"
                            value={cloudRelayUrl}
                            onChange={(e) => handleSave("cloudRelayUrl", e.target.value)}
                            placeholder="https://your-worker.workers.dev"
                            className="w-full text-xs px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-emerald-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                            中继验证密钥 (Secret Key)
                        </label>
                        <input
                            type="password"
                            value={cloudRelaySecret}
                            onChange={(e) => handleSave("cloudRelaySecret", e.target.value)}
                            placeholder="输入你的 Cloudflare 验证 Token"
                            className="w-full text-xs px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-emerald-500"
                        />
                    </div>

                    <button
                        onClick={testConnection}
                        disabled={status === "testing"}
                        className="w-full py-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 font-semibold text-xs rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-center justify-center space-x-1"
                    >
                        {status === "testing" ? "正在注册订阅..." : status === "success" ? "✓ 设备绑定成功！" : "测试连接并绑定此设备"}
                    </button>
                </div>
            )}
        </div>
    );
}
