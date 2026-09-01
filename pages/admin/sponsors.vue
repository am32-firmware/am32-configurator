<template>
  <div class="min-h-screen bg-gray-900">
    <!-- Header -->
    <header class="bg-gray-800 border-b border-gray-700">
      <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div class="flex items-center gap-4">
          <NuxtLink
            to="/"
            class="text-xl font-bold text-red-500"
          >
            AM32 Admin
          </NuxtLink>
          <span class="text-gray-400">|</span>
          <div class="flex items-center gap-4">
            <span class="text-white font-medium">Sponsors</span>
            <span class="text-gray-500">|</span>
            <NuxtLink
              to="/admin/users"
              class="text-gray-300 hover:text-white transition-colors"
            >
              Users
            </NuxtLink>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-gray-400 text-sm">{{ username }}</span>
          <UButton
            color="red"
            variant="soft"
            icon="i-mdi-logout"
            @click="handleLogout"
          >
            Logout
          </UButton>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 py-8">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold">
          Sponsors
        </h1>
        <UButton
          icon="i-mdi-plus"
          @click="openCreateModal"
        >
          Add Sponsor
        </UButton>
      </div>

      <!-- Loading State -->
      <div
        v-if="loading"
        class="flex justify-center py-12"
      >
        <UIcon
          name="i-mdi-loading"
          class="animate-spin text-4xl text-red-500"
        />
      </div>

      <!-- Empty State -->
      <UCard
        v-else-if="sponsors.length === 0"
        class="text-center py-12"
      >
        <UIcon
          name="i-mdi-image-off"
          class="text-6xl text-gray-500 mb-4"
        />
        <h2 class="text-xl font-semibold text-gray-300 mb-2">
          No Sponsors Yet
        </h2>
        <p class="text-gray-400 mb-4">
          Add your first sponsor to get started
        </p>
        <UButton
          icon="i-mdi-plus"
          @click="openCreateModal"
        >
          Add Sponsor
        </UButton>
      </UCard>

      <!-- Sponsors Table -->
      <UCard v-else>
        <UTable
          :rows="sponsors"
          :columns="columns"
          :loading="loading"
        >
          <template #image-data="{ row }">
            <div class="w-16 h-16 flex items-center justify-center bg-gray-800 rounded overflow-hidden">
              <img
                :src="row.image"
                :alt="row.name"
                class="max-w-full max-h-full object-contain"
              >
            </div>
          </template>

          <template #class-data="{ row }">
            <code class="text-xs bg-gray-800 px-2 py-1 rounded">{{ row.class || '-' }}</code>
          </template>

          <template #hideAfter-data="{ row }">
            <span
              v-if="row.hideAfter"
              class="text-yellow-400"
            >
              {{ formatDate(row.hideAfter) }}
            </span>
            <span
              v-else
              class="text-gray-500"
            >Never</span>
          </template>

          <template #actions-data="{ row }">
            <div class="flex gap-2">
              <UButton
                color="blue"
                variant="soft"
                icon="i-mdi-pencil"
                size="sm"
                @click="openEditModal(row)"
              />
              <UButton
                color="red"
                variant="soft"
                icon="i-mdi-delete"
                size="sm"
                :disabled="deleting"
                @click="confirmDelete(row)"
              />
            </div>
          </template>
        </UTable>
      </UCard>
    </main>

    <!-- Create/Edit Modal -->
    <UModal v-model="showModal">
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <h2 class="text-xl font-bold">
              {{ editingSponsor ? 'Edit Sponsor' : 'Add Sponsor' }}
            </h2>
            <UButton
              color="gray"
              variant="ghost"
              icon="i-mdi-close"
              @click="closeModal"
            />
          </div>
        </template>

        <UForm
          class="space-y-4"
          :state="form"
          @submit="handleSubmit"
        >
          <UFormGroup
            label="Name"
            name="name"
            required
          >
            <UInput
              v-model="form.name"
              placeholder="Sponsor name"
              :disabled="submitting"
            />
          </UFormGroup>

          <UFormGroup
            label="Sponsor Logo"
            name="image"
            required
          >
            <div class="space-y-3">
              <!-- Image Preview -->
              <div
                v-if="form.image"
                class="flex items-center justify-center bg-gray-800 rounded-lg p-4 border border-gray-700"
              >
                <img
                  :src="form.image"
                  alt="Preview"
                  class="max-h-24 max-w-full object-contain"
                >
              </div>

              <!-- Upload Area -->
              <div
                class="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors"
                :class="[
                  isDragging ? 'border-red-500 bg-red-500/10' : 'border-gray-600 hover:border-gray-500',
                  uploading ? 'opacity-50 cursor-not-allowed' : ''
                ]"
                @click="triggerFileInput"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleDrop"
              >
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  :disabled="uploading"
                  @change="handleFileSelect"
                >
                <div v-if="uploading" class="flex flex-col items-center gap-2">
                  <UIcon
                    name="i-mdi-loading"
                    class="animate-spin text-3xl text-red-500"
                  />
                  <span class="text-sm text-gray-400">Uploading...</span>
                </div>
                <div v-else class="flex flex-col items-center gap-2">
                  <UIcon
                    name="i-mdi-cloud-upload"
                    class="text-3xl text-gray-400"
                  />
                  <span class="text-sm text-gray-400">
                    Drop an image here or click to upload
                  </span>
                  <span class="text-xs text-gray-500">
                    JPEG, PNG, GIF, WebP, SVG (max 5MB)
                  </span>
                </div>
              </div>

              <!-- Manual URL Input -->
              <div class="flex items-center gap-2">
                <div class="h-px flex-1 bg-gray-700" />
                <span class="text-xs text-gray-500">or enter URL</span>
                <div class="h-px flex-1 bg-gray-700" />
              </div>
              <UInput
                v-model="form.image"
                placeholder="https://example.com/logo.png"
                :disabled="uploading || submitting"
                icon="i-mdi-link"
              />
            </div>
          </UFormGroup>

          <UFormGroup
            label="Website URL"
            name="url"
            required
          >
            <UInput
              v-model="form.url"
              placeholder="https://example.com"
              :disabled="submitting"
            />
          </UFormGroup>

          <UFormGroup
            label="CSS Classes"
            name="class"
          >
            <UInput
              v-model="form.class"
              placeholder="e.g., invert grayscale"
              :disabled="submitting"
            />
            <template #hint>
              <span class="text-xs text-gray-400">Optional CSS classes for styling (e.g., invert, grayscale)</span>
            </template>
          </UFormGroup>

          <UFormGroup
            label="Hide After Date"
            name="hideAfter"
          >
            <UInput
              v-model="form.hideAfter"
              type="datetime-local"
              :disabled="submitting"
            />
            <template #hint>
              <span class="text-xs text-gray-400">Sponsor will be hidden after this date (leave empty to show indefinitely)</span>
            </template>
          </UFormGroup>

          <UAlert
            v-if="error"
            icon="i-mdi-alert-circle"
            color="red"
            variant="soft"
            :title="error"
          />

          <div class="flex justify-end gap-2 pt-4">
            <UButton
              color="gray"
              variant="soft"
              :disabled="submitting"
              @click="closeModal"
            >
              Cancel
            </UButton>
            <UButton
              type="submit"
              :loading="submitting"
              :disabled="submitting"
            >
              {{ editingSponsor ? 'Update' : 'Create' }}
            </UButton>
          </div>
        </UForm>
      </UCard>
    </UModal>

    <!-- Delete Confirmation Modal -->
    <UModal v-model="showDeleteModal">
      <UCard>
        <template #header>
          <div class="flex items-center gap-2 text-red-500">
            <UIcon
              name="i-mdi-alert"
              class="text-2xl"
            />
            <h2 class="text-xl font-bold">
              Delete Sponsor
            </h2>
          </div>
        </template>

        <p class="text-gray-300 mb-4">
          Are you sure you want to delete <strong>{{ deletingSponsor?.name }}</strong>?
          This action cannot be undone.
        </p>

        <div class="flex justify-end gap-2">
          <UButton
            color="gray"
            variant="soft"
            :disabled="deleting"
            @click="showDeleteModal = false"
          >
            Cancel
          </UButton>
          <UButton
            color="red"
            :loading="deleting"
            :disabled="deleting"
            @click="handleDelete"
          >
            Delete
          </UButton>
        </div>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const router = useRouter();
const username = ref('');
const sponsors = ref<Sponsor[]>([]);
const loading = ref(true);
const showModal = ref(false);
const showDeleteModal = ref(false);
const editingSponsor = ref<Sponsor | null>(null);
const deletingSponsor = ref<Sponsor | null>(null);
const submitting = ref(false);
const deleting = ref(false);
const uploading = ref(false);
const isDragging = ref(false);
const error = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

const form = reactive({
    name: '',
    image: '',
    url: '',
    class: '',
    hideAfter: ''
});

const columns = [
    { key: 'image', label: 'Logo' },
    { key: 'name', label: 'Name' },
    { key: 'url', label: 'URL' },
    { key: 'class', label: 'CSS Classes' },
    { key: 'hideAfter', label: 'Hide After' },
    { key: 'actions', label: 'Actions' }
];

// Check authentication on mount
onMounted(async () => {
    try {
        const session = await $fetch<{ data: { username: string } }>('/api/admin/session');
        username.value = session.data.username;
        await fetchSponsors();
    } catch {
        router.push('/admin');
    }
});

async function fetchSponsors () {
    loading.value = true;
    try {
        const response = await $fetch<{ data: Sponsor[] }>('/api/admin/sponsors');
        sponsors.value = response.data;
    } catch (err: any) {
        if (err.statusCode === 401) {
            router.push('/admin');
        }
    } finally {
        loading.value = false;
    }
}

function openCreateModal () {
    editingSponsor.value = null;
    form.name = '';
    form.image = '';
    form.url = '';
    form.class = '';
    form.hideAfter = '';
    error.value = '';
    showModal.value = true;
}

function openEditModal (sponsor: Sponsor) {
    editingSponsor.value = sponsor;
    form.name = sponsor.name;
    form.image = sponsor.image;
    form.url = sponsor.url;
    form.class = sponsor.class;
    form.hideAfter = sponsor.hideAfter ? formatDateTimeLocal(sponsor.hideAfter) : '';
    error.value = '';
    showModal.value = true;
}

function closeModal () {
    showModal.value = false;
    editingSponsor.value = null;
    error.value = '';
}

function confirmDelete (sponsor: Sponsor) {
    deletingSponsor.value = sponsor;
    showDeleteModal.value = true;
}

async function handleSubmit () {
    submitting.value = true;
    error.value = '';

    try {
        const payload = {
            name: form.name,
            image: form.image,
            url: form.url,
            class: form.class,
            hideAfter: form.hideAfter ? new Date(form.hideAfter).toISOString() : null
        };

        if (editingSponsor.value) {
            await $fetch(`/api/admin/sponsors/${editingSponsor.value.id}`, {
                method: 'PUT',
                body: payload
            });
        } else {
            await $fetch('/api/admin/sponsors', {
                method: 'POST',
                body: payload
            });
        }

        closeModal();
        await fetchSponsors();
    } catch (err: any) {
        error.value = err.data?.statusMessage || 'An error occurred. Please try again.';
    } finally {
        submitting.value = false;
    }
}

async function handleDelete () {
    if (!deletingSponsor.value) {
        return;
    }

    deleting.value = true;
    try {
        await $fetch(`/api/admin/sponsors/${deletingSponsor.value.id}`, {
            method: 'DELETE'
        });
        showDeleteModal.value = false;
        deletingSponsor.value = null;
        await fetchSponsors();
    } catch (err: any) {
        if (err.statusCode === 401) {
            router.push('/admin');
        }
    } finally {
        deleting.value = false;
    }
}

async function handleLogout () {
    try {
        await $fetch('/api/admin/logout', { method: 'POST' });
        router.push('/admin');
    } catch {
        router.push('/admin');
    }
}

function formatDate (dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateTimeLocal (dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function triggerFileInput () {
    if (!uploading.value) {
        fileInput.value?.click();
    }
}

function handleFileSelect (event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
        uploadFile(file);
    }
}

function handleDrop (event: DragEvent) {
    isDragging.value = false;
    if (uploading.value) {
        return;
    }
    const file = event.dataTransfer?.files?.[0];
    if (file) {
        uploadFile(file);
    }
}

async function uploadFile (file: File) {
    uploading.value = true;
    error.value = '';

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await $fetch<{ data: { url: string } }>('/api/admin/upload', {
            method: 'POST',
            body: formData
        });

        form.image = response.data.url;
    } catch (err: any) {
        error.value = err.data?.statusMessage || 'Failed to upload image';
    } finally {
        uploading.value = false;
        if (fileInput.value) {
            fileInput.value.value = '';
        }
    }
}
</script>
