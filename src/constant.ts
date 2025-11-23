export const EXTERNAL = {
    onboarding_form_url: "https://form.typeform.com/to/FOz4fXGm",
    directus_url: "https://directus.bounteer.com",
    directus_key: "9Qfz6A4s0RjzSPLLIR0yT7NTptiPfTGQ", // guest account
    guest_user_id: "f25f8ce7-e4c9-40b8-ab65-40cde3409f27", // guest user id
    auth_idp_key: "logto",
    auth_idp_logput_url: "https://logto-app.bounteer.com/oidc/session/end?post_logout_redirect_uri=https://bounteer.com",
    webhook_url: "https://webhook.site/your-webhook-endpoint" // Replace with actual webhook endpoint
}
export const KEYWORDS = {
    name: "Bounteer",
    email: "sho@bounteer.com",
    metaKeywords: ["bounteer", "bounty", "hiring", "recruitment", "marketplace", "AI", "job", "referrals", "social", "technology"].join(", "),
};
export const SPEC = {
    mid_threshold: 60,
    high_threshold: 80,
};

export const JOBS = [
    {
        title: "Vice President of Business Development",
        location: "Remote",
        description:
            "We’re looking for a dynamic and visionary VP of Business Development to lead our growth strategy and expand our market presence. As a key member of the leadership team, you will shape and drive our client acquisition strategy, build and scale high-value partnerships, and identify emerging opportunities that align with our long-term vision. This role goes beyond closing deals—you’ll architect the roadmap for sustainable revenue growth, mentor a high-performing team, and collaborate cross-functionally to unlock new verticals and markets. If you’re a strategic thinker with a proven track record in scaling businesses, building strong executive- level relationships, and delivering measurable results, we’d be excited to partner with you in shaping the future of our company",
        tags: ["BD", "7+ Years Experience"],
    },
    {
        title: "AI Automation Intern",
        location: "Remote",
        description:
            "Join us as an AI Automation Intern and gain hands-on experience at the forefront of the AI automation industry. You’ll work directly with our technical team to design and implement N8N workflows, assist in software development projects, and explore real-world applications of cutting-edge AI tools. This is a unique opportunity to develop valuable skills, contribute to live projects, and kickstart your career in one of the fastest-growing tech sectors.",
        tags: ["N8N"],
    },
    // {
    //     title: "Senior Rust Backend Engineer",
    //     location: "Remote",
    //     description:
    //         "Join our backend team to build scalable, reliable, and secure APIs and services that power our SaaS platform.",
    //     tags: ["Rust", "Tokio", "PostgreSQL", "Kubernetes", "3+ Years Experience"],
    // },
    // {
    //     title: "Product Designer",
    //     location: "Remote",
    //     description:
    //         "We're seeking a talented product designer to create AI powered pipeline for our customers.",
    //     tags: ["UI/UX", "Figma", "User Research", "3+ Years Experience"],
    // },
];


export const JON_QUIRKS = [
    {
        title: "Flexible Work Environment",
        description: "Fully remote from anywhere in the world.",
        icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    },
    {
        title: "Cutting-Edge Technology",
        description: "Work with the latest AI workflows to solve challenging problems.",
        icon: "M13 10V3L4 14h7v7l9-11h-7z"
    },
    {
        title: "Diverse & Inclusive Team",
        description: "Join a global team with diverse backgrounds, perspectives, and experiences.",
        icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
    },
    {
        title: "Competitive Benefits",
        description: "Enjoy competitive salary, health benefits, stock options, and professional development opportunities.",
        icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
    }
];

export const FEATURES = [
    {
        title: "Earn Bounties by Referral",
        description:
            "Recommend great candidates and earn bounty rewards when they get hired — simple, transparent, and merit-based.",
        icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
        color: "accent",
    },
    {
      title: "Build Referrer Reputation",
      description:
            "Showcase successful referrals and grow a trusted profile. Your track record travels with you across roles and companies.",
        icon: "M3 3v18h18V3H3zm4 14l3-3 2 2 5-5 3 3",
        color: "accent",
    },
    {
      title: "Smart Ranking (Powered by RFI)",
      description:
            "Applicants are ranked using Bounteer’s Role Fit Index (RFI) so employers see stronger shortlists — and referrers know who to recommend first.",
        icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
        color: "accent",
    },
    {
      title: "Clear Bounty Details",
      description:
            "See payout amounts, eligibility criteria, and verification steps upfront. No guesswork — just clear, public terms.",
        icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
        color: "accent",
    },
    {
      title: "End-to-End Referral Tracking",
      description:
            "Share unique links and follow status from invite to offer, with timely updates so you always know where things stand.",
        icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
        color: "accent",
    },
    {
        title: "Global Roles, Remote-Friendly",
        description:
            "Discover bounties from startups and scale-ups worldwide — remote and on-site — and match them to your network.",
        icon: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z",
        color: "accent",
    },
];
