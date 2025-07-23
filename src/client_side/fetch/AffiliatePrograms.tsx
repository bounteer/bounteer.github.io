export const DIRECTUS_URL = 'https://directus.ismail.to';

export default async function fetchAffiliateProgramModel(): Promise<AffiliateProgramResponseData[]> {
    const activeFilter = "filter[is_active][_eq]=true";
    const fields = [
        "id",
        "referral_link",
        "website_link",
        "name",
        "summary",
        "description",
        "image",
        "deal_description",
        "tags.tags_id.name"
    ].join(',');

    const url = `${DIRECTUS_URL}/items/affiliate_programs?${activeFilter}&fields=${encodeURIComponent(fields)}`;

    const res = await fetch(url);

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch affiliate programs: ${res.statusText}\nReturned: ${errorText}`);
    }

    const json: AffiliateProgramResponse = await res.json();
    return json.data;
}

export interface AffiliateProgramResponseData {
    id: number;
    website_link: string;
    referral_link: string;
    name: string;
    summary: string;
    description: string;
    image: string | null;
    deal_description: string | null;
    tags: AffiliateProgramResponseDataTag[]; // assuming this is an array of plain strings
}

export interface AffiliateProgramResponseDataTag {
    tags_id: {
        name: string;
    };
}

export interface AffiliateProgramResponse {
    data: AffiliateProgramResponseData[];
}
