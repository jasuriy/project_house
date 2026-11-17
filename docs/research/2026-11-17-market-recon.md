# Market recon - Project House (2026-11-17)

Status: idea stage. No code yet. Tags: [V] verified from source fetched this session,
[C] claim from a vendor blog or aggregator (not independently checked), [U] unknown.

## Reference links Bek shared

| Site | What it actually is | Relevance to our idea |
|------|---------------------|-----------------------|
| project-hub.uk | Find collaborators for a project: post roles needed, screening questions, applicants join. Stages Idea / Planning / Building MVP. [V] fetched | NOT a showcase. It is team-finding. Different product. |
| projecthub.arduino.cc | Hardware project library, 6,640 projects, types Tutorial / Showcase / Getting started / WIP / Teardown, filters by product and difficulty. [V] fetched | No visual templates. Traffic comes from the Arduino hardware community, which a new platform does not have. |

## Similar products

| Product | Status | Note |
|---------|--------|------|
| Read.cv | Shut down May 16, 2025, team joined Perplexity [V] TechCrunch / Neowin | Professional profile + work showcase. Did not survive alone. |
| Polywork | Announced shutdown Jan 31, 2025 [V] Dealroom | LinkedIn alternative built around showing work. |
| Peerlist | Alive. $1.1M seed Jan 2023 [V] TechCrunch. User numbers 20k (2023) to "100k+" [C] | Has "Launchpad": weekly project launches with upvotes. Closest live competitor. |
| Devpost | Alive. One form for portfolio project and hackathon submission; project page lives after the event [V] Devpost product post | Hackathons give a reason to submit (deadline, judges, prizes). |
| Fueler | Alive. Project-first portfolio for students; paid tier [C] | Marketed at students + companies. |
| Projects Yard | Launched Feb 2026, "dual-sided portfolio" [C] | Same pitch as ours. Page fetch blocked (403). |
| Behance | Alive. Design portfolios. | Owns visual/design work. |
| Gamma, v0 (AI page generators) | Alive. Generate pages/decks from text, free tier exists [C] | Make "a beautiful page" cheap. Looks alone are not a moat. |

## Uzbekistan signals

- IT Park "Talent Park" collects candidates via a Telegram bot, aims beyond Tashkent [C] IT Park press release.
- Implication: Telegram is the main sharing channel. Link previews must look good in Telegram.

## Legal: where user data may be stored

- Original Article 27-1 (2021): personal data of Uzbek citizens had to be stored on servers
  physically in Uzbekistan [C] kun.uz.
- Amended March 2026: biometric, genetic and telecom-subscriber data must stay domestic; other
  personal data may be stored abroad only if listed conditions are met (e.g. adequate-protection
  country) [C] daryo.uz, kun.uz.
- [U] Exact conditions. Cheapest check: read amended Article 27-1 on lex.uz, or ask a lawyer.
- Design implication: keep data in plain Postgres so it can move to an Uzbek host if required.

## Sources

- https://daryo.uz/en/2026/03/29/uzbekistan-amends-personal-data-law-for-domestic-storage-and-regulated-foreign-processing/
- https://kun.uz/en/news/2026/03/27/uzbekistan-amends-personal-data-law-to-facilitate-global-payment-systems
- https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/

- https://www.project-hub.uk/
- https://projecthub.arduino.cc/
- https://techcrunch.com/2025/01/17/perplexity-acquires-read-cv-a-social-media-platform-for-professionals/
- https://www.neowin.net/news/readcv-announces-acquisition-by-perplexity-as-it-begins-winding-down-operations/
- https://dealroom.co/companies/polywork/
- https://techcrunch.com/2023/01/23/hubspot-dharmesh-shah-peerlist-investment-linkedin-alternative
- https://peerlist.io/blog/commentary/peerlist-launchpad-the-path-forward
- https://fueler.io/blog/best-career-portfolio-platforms-for-students
- https://f4.fund/startups/projectsyard
- https://www.it-park.uz/en/itpark/news/it-park-uzbekistan-expands-employment-opportunities-for-young-people
