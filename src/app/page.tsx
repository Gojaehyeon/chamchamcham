import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
      <div className="max-w-2xl w-full flex flex-col items-center gap-10 text-center">
        <div>
          <h1 className="text-6xl sm:text-8xl font-black tracking-tight">
            참참참
          </h1>
          <p className="mt-3 text-zinc-500">
            웹캠으로 손과 얼굴 방향을 감지하는 참참참 게임
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <Link
            href="/attack"
            className="rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 hover:border-black dark:hover:border-white transition-colors text-left"
          >
            <div className="text-5xl mb-3">👉</div>
            <div className="text-xl font-bold mb-1">공격</div>
            <p className="text-sm text-zinc-500 leading-relaxed">
              내가 손으로 좌/우를 가리킨다. 상대(AI) 얼굴 방향과 같으면 승리.
            </p>
          </Link>
          <Link
            href="/defense"
            className="rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 hover:border-black dark:hover:border-white transition-colors text-left"
          >
            <div className="text-5xl mb-3">🙂</div>
            <div className="text-xl font-bold mb-1">수비</div>
            <p className="text-sm text-zinc-500 leading-relaxed">
              내가 얼굴을 좌/우로 돌려 피한다. 상대(AI) 손 방향과 다르면 승리.
            </p>
          </Link>
        </div>
        <p className="text-xs text-zinc-400 max-w-md">
          브라우저 카메라 권한이 필요합니다. 밝은 곳에서 상반신이 잘 보이도록
          앉아주세요.
        </p>
      </div>
    </div>
  );
}
