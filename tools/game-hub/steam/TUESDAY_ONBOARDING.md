# Tuesday Steamworks onboarding

Status: **TEST checklist** · human account actions only

Target date: **Tuesday, 18 August 2026**

## Before starting

- Agree which legal person or entity will sign the Steam Distribution
  Agreement and receive revenue. The entered name must match the bank and tax
  information Steamworks expects.
- Decide which individual Steam account will pay the Steam Direct fee. Valve's
  current documentation says the app credit is attached to the payer's account
  and only that payer can activate it.
- Have a payment method available outside Steam Wallet. The current fee is
  **USD 100 or local equivalent per product**, plus any applicable tax.
- Keep identity, address, tax, banking, payment, Steam Guard, recovery codes,
  and authorization data out of this repository and out of screenshots.

## In Steamworks

1. Create or sign into the intended Steam account and complete the Steamworks
   partner onboarding flow.
2. Read the Steam Distribution Agreement and confirm the correct legal party.
3. Complete the private identity, tax, and bank steps inside Steamworks.
4. Pay one Steam Direct fee for **AXM Local GameHub**.
5. With the same account that paid, activate the app credit when Steamworks
   makes it available.
6. Invite the second trusted account through Steamworks user management instead
   of sharing a password. Grant only the permissions that role needs.
7. Record the new **App ID** and default **Depot ID** in
   `steam-product-plan.json`. Those numeric IDs are not secrets. Do not record
   account names or private onboarding data.
8. Confirm the working app name is `AXM Local GameHub` or record the chosen
   replacement before store art and copy are finalized.

## Immediately after onboarding

- Run `node tools/game-hub/steam/steam-readiness.js` and preserve the HOLD
  verdict until the listed evidence exists.
- Choose the release track: full release or Early Access. Do not select Early
  Access merely to bypass quality work; its store answers must truthfully
  describe what is playable now and what remains.
- Start the content survey worksheet, especially the pre-generated AI content,
  any live AI seat capability included in the shipping build, simulated casino
  content, and combat/violence across the library.
- Finalize the product boundary before uploading a depot. The first review is
  Windows-only unless another operating system is independently packaged and
  tested.
- Do not put `steam_appid.txt` in the uploaded depot. Valve documents it as a
  local development aid that should be removed from Steam uploads.

## Timeline truth

If payment occurs on 18 August, **17 September 2026** is the earliest date
allowed by the 30-day fee waiting rule alone. It is not a promised launch date.
The Coming Soon page must also be public for at least two weeks, and Valve asks
developers to plan at least seven business days for store/build review and
possible corrections. Both the store presence and near-final build must be
approved before release.
