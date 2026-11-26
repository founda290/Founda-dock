import { Card } from "@/components/ui";

export default function HelpPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h2 className="text-base font-semibold text-text">Founda Dock — Code. Create. Automate.</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-text-2">
          Founda Dock is the browser control centre for your Android-hosted Station. The phone runs the shell, processes
          and agents through Termux; this interface monitors and controls them. It never pretends to be the execution
          environment itself.
        </p>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-text">Getting started</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-text-2">
          <li>Open <span className="font-mono text-[12px]">Connections</span> and pair this browser with your Android device using the code shown on the phone.</li>
          <li>Check the <span className="font-mono text-[12px]">Dashboard</span> — the Station status, resources and services update live.</li>
          <li>Open <span className="font-mono text-[12px]">Terminal</span> to work in a real shell on the device. Sessions persist and reconnect automatically.</li>
          <li>Manage <span className="font-mono text-[12px]">OpenCode</span> and <span className="font-mono text-[12px]">OpenClaw</span> from the Agents page.</li>
        </ol>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-text">Mock vs live mode</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-text-2">
          By default the app runs in <strong className="text-text">SIMULATED</strong> mode with clearly-labelled sample data,
          so the full interface works before the Android runtime exists. Set{" "}
          <span className="font-mono text-[12px]">NEXT_PUBLIC_STATION_MODE=real</span> and{" "}
          <span className="font-mono text-[12px]">NEXT_PUBLIC_STATION_API_URL</span> to connect to a real Station.
          See <span className="font-mono text-[12px]">docs/API_CONTRACT.md</span> for the full contract.
        </p>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-text">Security</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-text-2">
          Remote terminal access is always authenticated. Secrets are write-only and never displayed after saving.
          The runtime enforces workspace filesystem boundaries and authorises every sensitive operation independently.
        </p>
      </Card>
    </div>
  );
}
