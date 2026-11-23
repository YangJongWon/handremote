# Tailscale connections

handide and handremote are independent applications. Each has its own server,
settings, pairing token and CLI. Either works without installing the other.

Install as before:

```sh
npm install -g github:YangJongWon/handide
# Install handremote separately if wanted (Windows):
npm install -g github:YangJongWon/handremote
```

Use the normal Tailscale sign-in on the PC and phone. No administrator API key,
host tag or named Service registration is required.

```sh
handide remote
handide
```

handide's existing `remote` command installs Tailscale if needed and guides the
ordinary sign-in and one-time HTTPS approval. `handide remote setup` is an optional
alias that also saves this app's port. The existing `remote --public` opt-in remains
available.

For handremote, install Tailscale normally if it is missing, then:

```sh
handremote remote setup
handremote
```

The setup command uses the installed Tailscale CLI and shows its ordinary login
link when signed out. If Tailscale asks for one-time HTTPS approval, complete the
approval at the link it prints and rerun setup. handremote stays private to the
tailnet; it does not publish a Funnel link.

## Main addresses

| App | Default Tailscale address | Local backend port |
| --- | --- | --- |
| handide | `https://<pc>.<tailnet>.ts.net` | 9000 |
| handremote | `https://<pc>.<tailnet>.ts.net:9443` | 9100 |

The terminal and connection page label each link with its app name. Scan the QR
or use the complete link printed by the app: it includes the pairing token.
`localhost` connection pages are PC-only tools for showing a larger QR.

The shared hostname identifies the PC. Separate HTTPS ports route to separate
application processes. Starting either app does not start the other. Their
optional integration does not merge the servers.

## Commands

```sh
handide remote status --json
handremote remote status --json
handide remote setup --plan
handremote remote setup --plan
# Custom backend and HTTPS port for handremote:
handremote remote setup --port 9300 --ts-port 9543
```

`status` and `--plan` do not change routing or settings. Setup saves only this
app's settings in `remote-service.json` under its own data directory. `--data-dir`
selects another profile. Startup options override saved ports. Setup refuses to
overwrite a device HTTPS port already forwarding to another backend.

`ready` means the remote URL answers as the same app process as the local server.
`configured` means routing exists but the app is stopped or could not be verified.

Existing named Tailscale Services continue to work when they route to this app
and its health check verifies the same process. `--service-name` can select an
already configured Service at startup. The normal install and setup flow does
not create Services, edit tailnet policy, tag this PC or require API credentials.

## Optional: app-name addresses

`https://handide.<tailnet>.ts.net` and `https://handremote.<tailnet>.ts.net` are
Tailscale Services. They need no API key, but three one-time steps in the
Tailscale admin console that only a tailnet admin can do:

```sh
handide remote setup --name        # or: handremote remote setup --name
```

On a PC without a tag, this sets up the default address as usual and then prints:

1. the lines to merge into the tailnet policy file (`tagOwners` for
   `tag:handapps`, `autoApprovers.services` for `svc:handide` and
   `svc:handremote`, and a grant so your devices reach them), once per tailnet;
2. where to define each Service (admin console → Services → Define a Service,
   port `tcp:443`), once per tailnet and app;
3. how to tag this PC in the admin console (Machines → Edit tags → `tag:handapps`;
   no new sign-in).

Run the same command again: on a tagged PC it runs
`tailscale serve --service=svc:<app> --https=443 https+insecure://127.0.0.1:<port>`
and saves the name. Without the `autoApprovers` lines, approve the PC once under
the Service's **Service hosts** in the admin console. The app uses the app-name
address only after it answers as this same process; until then it keeps the
default address.

**Trade-off.** A Service host must be a tagged PC, and a tagged PC is owned by the
tag instead of your account. handide finds your other PCs by themselves only when
both are owned by your account, so on a tagged PC add them with
`handide devices add`. handide says so at startup.

`--no-name` stops serving the Service on this PC and forgets the name. The tag
stays; signing in again with `tailscale up --force-reauth` gives the PC back to
your account.
