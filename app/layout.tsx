import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'TrailGuard AI · Mission control',description:'A working emergency coordination simulation: offline reporting, validated rescue plans and adaptive replanning.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
