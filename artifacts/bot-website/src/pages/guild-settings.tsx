import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import { fetchMe, fetchGuildCache, fetchGuildSettings, saveGuildSettings } from "@/lib/auth";

const settingsSchema = z.object({
  welcomeEnabled: z.boolean().default(false),
  welcomeChannelId: z.string().nullable().optional(),
  welcomeMessage: z.string().nullable().optional(),
  autoRoleEnabled: z.boolean().default(false),
  autoRoleId: z.string().nullable().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function GuildSettings() {
  const { guildId } = useParams<{ guildId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [cache, setCache] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      welcomeEnabled: false,
      welcomeChannelId: "",
      welcomeMessage: "",
      autoRoleEnabled: false,
      autoRoleId: "",
    },
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      const me = await fetchMe();
      if (!me) { setAuthed(false); setLoading(false); return; }
      setAuthed(true);

      try {
        const [c, s] = await Promise.all([
          fetchGuildCache(guildId),
          fetchGuildSettings(guildId),
        ]);
        setCache(c);
        form.reset({
          welcomeEnabled: s.welcomeEnabled ?? false,
          welcomeChannelId: s.welcomeChannelId ?? "",
          welcomeMessage: s.welcomeMessage ?? "",
          autoRoleEnabled: s.autoRoleEnabled ?? false,
          autoRoleId: s.autoRoleId ?? "",
        });
      } catch {
        toast({ title: "Hata", description: "Sunucu verileri yüklenemedi.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [guildId]);

  async function onSubmit(data: SettingsFormValues) {
    setSaving(true);
    try {
      await saveGuildSettings(guildId, data);
      toast({ title: "Kaydedildi", description: "Sunucu ayarları başarıyla güncellendi." });
    } catch {
      toast({ title: "Hata", description: "Ayarlar kaydedilemedi. Lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (authed === false) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 max-w-lg text-center">
          <p className="text-muted-foreground mb-4">Bu sayfayı görüntülemek için giriş yapman gerekiyor.</p>
          <Button onClick={() => setLocation("/dashboard")}>Giriş Sayfasına Git</Button>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 max-w-3xl flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" asChild className="shrink-0" data-testid="button-back">
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{cache?.guildName || "Sunucu Ayarları"}</h1>
            <p className="text-muted-foreground">Bu sunucu için modülleri ve yapılandırmayı yönet.</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Hoşgeldin Sistemi */}
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle>Hoşgeldin Sistemi</CardTitle>
                <CardDescription>Yeni üyeler için hoşgeldin mesajlarını yapılandır.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="welcomeEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/50 p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Hoşgeldin Mesajlarını Etkinleştir</FormLabel>
                        <FormDescription>Sunucuya yeni biri katıldığında mesaj gönderir.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-welcome-enabled" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {form.watch("welcomeEnabled") && (
                  <>
                    <FormField
                      control={form.control}
                      name="welcomeChannelId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hoşgeldin Kanalı</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger data-testid="select-welcome-channel">
                                <SelectValue placeholder="Bir kanal seç" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {cache?.channels?.map((c: { id: string; name: string }) => (
                                <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>Hoşgeldin mesajlarının gönderileceği kanal.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="welcomeMessage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hoşgeldin Mesajı</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="{user}, {server} sunucusuna hoş geldin!"
                              data-testid="input-welcome-message"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>Kullanılabilir değişkenler: {"{user}"}, {"{server}"}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Otomatik Rol */}
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle>Otomatik Rol</CardTitle>
                <CardDescription>Yeni üyelere otomatik olarak bir rol ata.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="autoRoleEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/50 p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Otomatik Rolü Etkinleştir</FormLabel>
                        <FormDescription>Kullanıcılar katıldığında anında bir rol atar.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-autorole-enabled" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {form.watch("autoRoleEnabled") && (
                  <FormField
                    control={form.control}
                    name="autoRoleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Atanacak Rol</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger data-testid="select-autorole">
                              <SelectValue placeholder="Bir rol seç" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {cache?.roles?.map((r: { id: string; name: string }) => (
                              <SelectItem key={r.id} value={r.id}>@{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>Botun rolünün bu rolden daha üstte olduğundan emin ol.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
              <CardFooter className="pt-6">
                <Button type="submit" disabled={saving} className="w-full sm:w-auto" data-testid="button-save-settings">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Değişiklikleri Kaydet
                </Button>
              </CardFooter>
            </Card>
          </form>
        </Form>
      </div>
    </Layout>
  );
}
