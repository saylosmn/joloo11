import { Redirect } from "expo-router";

import { LoadingView } from "@/src/components/ui";

/**
 * Google sends the browser back to <scheme>://oauthredirect once sign-in ends.
 * The auth session reads that url on its own, but the router also receives it
 * as a deep link and would otherwise land on "Unmatched Route". Catching it
 * here sends the user back to the entry screen, which shows the right thing
 * once the token exchange finishes.
 */
export default function OAuthRedirect() {
  return (
    <>
      <LoadingView label="Нэвтэрч байна..." />
      <Redirect href="/" />
    </>
  );
}
