# 🧭 Getting Started with Git & GitHub — A Beginner's Walkthrough

This guide takes you from zero to having Chronicler safely backed up on GitHub.
No prior Git experience assumed. Follow it top to bottom.

---

## What is Git? What is GitHub?

- **Git** is a tool on your computer that tracks every change to your files,
  like an infinite undo history with labeled save points ("commits").
- **GitHub** is a website that stores a copy of your Git project online — a
  backup, and the place deployment tools connect to.

Think of Git as the camera and GitHub as the photo album in the cloud.

---

## Step 1 — Install the tools

**Git:**
- Mac: open Terminal, type `git --version`. If it's missing, it'll offer to install.
- Windows: download from https://git-scm.com/download/win and run the installer (accept defaults).

**A GitHub account:**
- Sign up free at https://github.com

**(Optional but recommended) GitHub Desktop** — a friendly visual app so you
don't have to memorize commands: https://desktop.github.com
This guide gives you BOTH the command-line and the Desktop way.

---

## Step 2 — Get the project onto your computer

1. Download the `chronicler` project folder (provided alongside this guide).
2. Unzip it somewhere you'll find it, e.g. `Documents/chronicler`.

---

## Step 3 — Make sure it runs

Open a terminal **inside the chronicler folder** and run:

```bash
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173). You should see
Chronicler with the Characters page. Press `Ctrl+C` in the terminal to stop it.

> No Node.js yet? Install the "LTS" version from https://nodejs.org first.

---

## Step 4 — Put it on GitHub

### The easy way (GitHub Desktop)

1. Open GitHub Desktop → **File → Add Local Repository** → pick your chronicler folder.
2. It'll say "this isn't a Git repository — create one?" → click **Create a Repository**.
3. Fill in the name (`chronicler`), leave defaults, click **Create Repository**.
4. You'll see all your files listed as changes. In the bottom-left, type a
   summary like `Initial commit` and click **Commit to main**.
5. Click **Publish repository** at the top.
6. **IMPORTANT: check the "Keep this code private" box** (see Step 6 below).
7. Done — your code is on GitHub.

### The command-line way

Inside the chronicler folder:

```bash
git init
git add .
git commit -m "Initial commit"
```

Then create an empty repo on github.com (the **+** menu → New repository →
name it `chronicler` → **Private** → Create). GitHub will show you commands
to "push an existing repository" — copy the two lines that look like:

```bash
git remote add origin https://github.com/YOUR-USERNAME/chronicler.git
git push -u origin main
```

Refresh the GitHub page — your files are there.

---

## Step 5 — The everyday rhythm

Whenever you've made changes you want to save:

**GitHub Desktop:** type a short summary of what changed → Commit to main → Push origin.

**Command line:**
```bash
git add .
git commit -m "Describe what you changed"
git push
```

That's 90% of Git. Commit often — small save points are easier to return to.

---

## Step 6 — Private or public?

**Start private.** You can flip to public anytime later, but you can't
un-publish history. Two reasons this matters:

1. You'll experiment early, and may not want it all visible.
2. When you add Supabase keys later, a private repo limits the damage if a
   secret ever slips in. (The `.gitignore` already excludes `.env` so your
   secrets won't be committed — but private is a safe second layer.)

Open-source it later, once it has shape and you've confirmed no secrets are in
the history.

---

## The golden rule about secrets

**Never commit your `.env` file.** It holds passwords and API keys.
This project's `.gitignore` already blocks it. When you set up Supabase:

1. Copy `.env.example` to a new file named `.env`
2. Put your real keys in `.env`
3. Confirm `git status` does NOT list `.env` before committing

If you ever see `.env` in the list of files to commit, STOP and don't commit.

---

## Where to go next

Once this is on GitHub, you can connect it to **Vercel** (https://vercel.com)
or **Netlify** — both deploy your site automatically every time you push,
giving Chronicler a real public URL. That's the natural next step after Phase 1.
