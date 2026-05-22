# Sift — UI/UX References

Apps, articles, and docs the design is informed by. Cite specific URLs in `learnings.md` and `changelog.md` entries when relevant.

## Apple HIG / iOS design system

- [Liquid Glass — Apple Developer](https://developer.apple.com/documentation/TechnologyOverviews/liquid-glass) — current iOS material system.
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) — index.
- [Materials — HIG](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Typography — HIG](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Meet Liquid Glass — WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/) — introduction.
- [Build a UIKit app with the new design — WWDC25](https://developer.apple.com/videos/play/wwdc2025/284/) — practical patterns.
- [New design gallery 2026](https://developer.apple.com/design/new-design-gallery-2026/) — current Apple-app examples.
- [The details of UI typography — WWDC20](https://developer.apple.com/videos/play/wwdc2020/10175/) — Dynamic Type pairing logic.

## Financial / earnings apps — what to lift

- **Apple Stocks** — closest mental model for Sift; single-line rows, calendar inline, earnings dates surfaced in detail.
- **Public.com** — AI-generated earnings recaps, glass texture for transparency framing, timeline event markers.
- **Bloomberg consumer iOS** — calm hierarchy, persistent indices strip, deferential chrome ([UX analysis — Blue Label](https://www.bluelabellabs.com/work/bloomberg/)).
- **Wealthfront** — neutral palette, large numbers, unobtrusive-but-present disclaimer footers.

## Financial apps — patterns to AVOID (signal "trading casino")

- **Robinhood** — confetti, gradient candy colours, swipe-to-trade, "manage friction" UX. ([Robinhood UI analysis — World Business Outlook](https://worldbusinessoutlook.com/how-the-robinhood-ui-balances-simplicity-and-strategy-on-mobile/))
- **Atom Finance** — pro-tool density, overwhelming on mobile. ([UX review](https://medium.com/productsins/everything-wrong-with-atom-in-less-than-8-minutes-96b9d64b34e7))
- **Stockal** and similar — busy dashboards with 6+ chart types per screen.

## Calm-density design references (non-financial)

- [Linear — A calmer interface](https://linear.app/now/behind-the-latest-design-refresh)
- [Linear UI redesign Part II](https://linear.app/now/how-we-redesigned-the-linear-ui)
- **Reeder**, **Things 3** — monochrome base, single accent, chips not icons (no published writeups; reference by observation).
- [Empty states — Eleken](https://www.eleken.co/blog-posts/empty-state-ux)
- [Empty States — Mobbin](https://mobbin.com/glossary/empty-state)

## RN library docs

- [@gorhom/bottom-sheet docs](https://gorhom.github.io/react-native-bottom-sheet/)
- [Bottom-sheet issue #2600 — Reanimated 4 compat](https://github.com/gorhom/react-native-bottom-sheet/issues/2600)
- [Expo Router Native Tabs](https://docs.expo.dev/router/advanced/native-tabs/)
- [expo-blur](https://docs.expo.dev/versions/latest/sdk/blur-view/)
- [expo-blur SDK 55 notes — discussion](https://github.com/expo/expo/discussions/37905)
- [expo-haptics](https://docs.expo.dev/versions/latest/sdk/haptics/)
- [Haptics patterns — Newly](https://newly.app/articles/haptics-mobile-apps)
- [Moti Skeleton](https://moti.fyi/skeleton)
- [Skeleton with Reanimated — Reactiive](https://reactiive.io/articles/skeleton-loader)
- [ReanimatedSwipeable / gesture handler](https://docs.swmansion.com/react-native-gesture-handler/docs/1.x/api/components/swipeable/)
- [Shared Element Transitions — Reanimated](https://docs.swmansion.com/react-native-reanimated/docs/shared-element-transitions/overview/)
- [FlashList + Reanimated](https://shopify.github.io/flash-list/docs/guides/reanimated/)
- [FlashList LayoutAnimation](https://shopify.github.io/flash-list/docs/guides/layout-animation/)
- [Victory Native XL](https://github.com/FormidableLabs/victory-native-xl)
- [Charts comparison — Nerdify](https://getnerdify.com/blog/charts-react-native/)
- [expo-live-activity](https://github.com/software-mansion-labs/expo-live-activity)
- [iOS Live Activities guide — Newly](https://newly.app/articles/ios-live-activities)

## Compliance / disclaimers

- ["Not Financial Advice" won't keep you out of jail — Bracewell](https://www.bracewell.com/news-events/saying-not-financial-advice-wont-keep-you-out-jail-crypto-lawyers/)
- [Are you illegally giving financial advice? — Givner Law](https://www.givnerlawpc.com/fintwit-law/are-you-illegally-giving-financial-advice)
- [Financial disclaimers — Free Privacy Policy](https://www.freeprivacypolicy.com/blog/financial-disclaimers/)
- [Confidence Visualization Patterns — Agentic Design](https://agentic-design.ai/patterns/ui-ux-patterns/confidence-visualization-patterns)
- [Are Model Predictions Probabilities? — Google PAIR](https://pair.withgoogle.com/explorables/uncertainty-calibration/)
- [Apple Health Studies legal acknowledgement pattern](https://support.apple.com/guide/healthregister/1-review-and-accept-the-legal-agreements-apdb79663ae1/web)

## Accessibility + responsive

- [RN Accessibility docs](https://reactnative.dev/docs/accessibility)
- [RN Accessibility Guide 2026 — Relay](https://reactnativerelay.com/article/react-native-accessibility-guide-building-inclusive-apps-expo)
- [react-native-ama labels — Nearform](https://nearform.com/open-source/react-native-ama/guidelines/accessibility-label/)
- [Max width for RN web — React Native School](https://www.reactnativeschool.com/setting-max-width-when-supporting-web-and-mobile-in-react-native/)
- [Dynamic Type guide — Bootcamp](https://medium.com/design-bootcamp/a-product-designers-guide-to-dynamic-type-in-ios-a105dda39a95)
- [iPhone font size guidelines — Learn UI Design](https://www.learnui.design/blog/ios-font-size-guidelines.html)

## How to add to this file

When a tick draws on a new source, add it under the appropriate heading with a one-line note on what it taught us. Don't dump unrelated reading lists here — the bar is "informed an actual decision".
