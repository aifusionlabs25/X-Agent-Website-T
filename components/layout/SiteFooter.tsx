export default function SiteFooter() {
    return (
        <footer className="bg-zinc-950 border-t border-zinc-800 py-10 text-center text-zinc-500 text-sm">
            <p>© {new Date().getFullYear()} AI Fusion Labs. All rights reserved.</p>
            <p className="mt-1 text-zinc-600">
                Built with Next.js · Powered by Tavus · Deployed on Vercel
            </p>
        </footer>
    );
}
