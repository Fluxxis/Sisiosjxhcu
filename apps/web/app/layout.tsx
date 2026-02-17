import "../styles/globals.css";
import { Providers } from "../components/Providers";
export const metadata = { title: "Raise TON" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <div className="appShell">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
