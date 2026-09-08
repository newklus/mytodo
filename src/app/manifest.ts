import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyTodo",
    short_name: "MyTodo",
    description: "회사 업무 관리용 TODO 앱",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    // 설치된 앱이 이미 떠 있는 상태에서 아이콘을 다시 클릭하면 새 창 대신 기존 창을 포커스한다.
    launch_handler: { client_mode: "focus-existing" },
    icons: [
      { src: "/icons/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
