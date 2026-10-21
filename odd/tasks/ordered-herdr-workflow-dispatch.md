Feature: ordered-herdr-workflow-dispatch
Issue: #13
Branch: feat/herdsman-lifecycle-evidence

## Specs
1. S1: "pi herder orchestration non avvia correttamente tutte le direttive seocno cui deve avviare altre sessioni pi in parallelo seocnod un ordine di tabs e nuemrate ed etichetatte, in altri pane o tabs herdr"
2. S2: "inoltre non esegue correttamente pi worjflow e ed engienring exellence o altre skills"
3. S3: "puoi contorllare e capire dove correggere e commttare le modifiche e pubblicare le variazioni"

## Tasks
- T1 | S1 | Enable trusted project Herdr workflow transport and preserve deterministic numbered tab order | commit: 00ef20d
- T2 | S2 | Make PiWorkflow agent routing pass verified skills, extensions, labels, and worktrees explicitly | commit: 00ef20d
- T3 | S1-S3 | Add structural/runtime smoke checks and synchronize operator documentation | commit: 00ef20d

## Log
- L1: mi sono reso conto che pi herder orchestration non avvia correttamente tutte le direttive seocno cui deve avviare altre sessioni pi in parallelo seocnod un ordine di tabs e nuemrate ed etichetatte, in altri pane o tabs herdr, inoltre non esegue correttamente pi worjflow e ed engienring exellence o altre skills, puoi contorllare e capire dove correggere e commttare le modifiche e pubblicare le variazioni — da vero developer e team agentico che opera con git e aiuta llm ad avere una cornistoria
- L2: Focused dispatch tests, full npm tests, environment check, init script help, diff check, and native Gentle review passed; native review found and verified the generated-settings newline correction.
