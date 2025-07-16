export const DIRECTUS_URL = 'https://directus.ismail.to';

export default async function fetchAffiliateProgramModel(): Promise<AffiliateProgramResponseData[]> {
    const active_filter = "filter[is_active][_eq]=true"
    const fields = "id,referral_link,name,summary,description,image,deal_description,tags.tags_id.name"
    const res = await fetch(
        `${DIRECTUS_URL}/items/affiliate_programs?${active_filter}&fields=${fields}`
    );
    if (!res.ok) {
        throw new Error(`Failed to fetch affiliate programs: ${res.statusText},\nreturned: ${res.body}`);
    }

    const json: AffiliateProgramResponse = await res.json();
    return json.data;
}

export interface AffiliateProgramResponseData {
    id: number;
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
