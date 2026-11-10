<script lang="ts">
	import { getPageContext } from '$lib/utils/page';
	const { goto } = getPageContext();

	import { onMount } from 'svelte';

	onMount(() => {
		goto('/admin/users', { replaceState: true });
	});
</script>
