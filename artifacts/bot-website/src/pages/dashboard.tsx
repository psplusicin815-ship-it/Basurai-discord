import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SiDiscord } from "react-icons/si";
import { Loader2, LogOut, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getSessionId,
  setSessionId,
  fetchMe,
  fetchMyGuilds,
  loginUrl,
  logout,
} from "@/lib/auth";

interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  global_name: string | null;
}

interface Guild {
  guildId: string;
  guildName: string;
  guildIcon: string | null;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [guilds, setGuilds] = useState<Guild[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // URL'den session_id al (OAuth callback'ten gelmiş olabilir)
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session_id");
    if (sid) {
      setSessionId(sid);
      // session_id'yi URL'den temizle
      const clean = window.location.pathname;
      window.history.replaceState({}, "", clean);
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const me = await fetchMe();
        if (!me) {
          setLoading(false);
          return;
        }
        setUser(me);
        const g = await fetchMyGuilds();
        setGuilds(g || []);
      } catch {
        setError("Veriler yüklenirken hata oluştu.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
    setGuilds(null);
    setLocation("/");
  }

  // Giriş yapılmamış
  if (!loading && !user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 max-w-lg text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 border border-primary/20">
            <SiDiscord className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Yönetim Paneli</h1>
          <p className="text-muted-foreground mb-8">
            Sunucularını yönetmek için Discord hesabınla giriş yap. Sadece yönetici olduğun ve BasurAi'nin bulunduğu sunucular görünecek.
          </p>
          <a
            href={loginUrl()}
            data-testid="button-discord-login"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#5865F2] px-8 text-base font-semibold text-white shadow-[0_0_20px_rgba(88,101,242,0.4)] transition-all hover:bg-[#4752c4] hover:shadow-[0_0_30px_rgba(88,101,242,0.6)]"
          >
            <SiDiscord className="w-5 h-5" />
            Discord ile Giriş Yap
          </a>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 max-w-lg text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Tekrar Dene</Button>
        </div>
      </Layout>
    );
  }

  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Kullanıcı başlığı */}
        <div className="flex items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <img
              src={avatarUrl}
              alt={user?.username}
              className="w-12 h-12 rounded-full border-2 border-primary/30"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {user?.global_name || user?.username}
              </h1>
              <p className="text-muted-foreground text-sm">Yönetici olduğun sunucular aşağıda</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            data-testid="button-logout"
            className="shrink-0"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Çıkış Yap
          </Button>
        </div>

        {/* Sunucu listesi */}
        {!guilds || guilds.length === 0 ? (
          <Card className="p-12 text-center border-dashed bg-muted/5">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <SiDiscord className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Uygun sunucu bulunamadı</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Yönetici olduğun ve BasurAi'nin bulunduğu bir sunucu yok. Önce botu sunucuna ekle.
            </p>
            <a
              href="https://discord.com/oauth2/authorize?client_id=1487520589722685551&permissions=8&scope=bot%20applications.commands"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ExternalLink className="w-4 h-4" />
              Sunucuya Ekle
            </a>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {guilds.map((guild) => (
              <Link key={guild.guildId} href={`/dashboard/${guild.guildId}`}>
                <Card
                  data-testid={`card-guild-${guild.guildId}`}
                  className="hover:border-primary/50 hover:bg-muted/10 transition-all cursor-pointer h-full border-border/50 bg-background/50 backdrop-blur-sm group"
                >
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      {guild.guildIcon ? (
                        <img
                          src={guild.guildIcon}
                          alt={guild.guildName}
                          className="w-12 h-12 rounded-full border border-primary/20 group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:scale-105 transition-transform">
                          <span className="font-semibold text-primary text-lg">
                            {guild.guildName.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-base line-clamp-1">{guild.guildName}</CardTitle>
                        <CardDescription className="text-xs">Ayarları Düzenle</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
