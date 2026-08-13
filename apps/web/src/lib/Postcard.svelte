<script lang="ts">
  import type { PostcardComposition } from '@bravecat/core/postcards'
  import { renderPostcardCanvas } from '@bravecat/core/postcards'
  import { webPostcardCanvas } from './platform/ports'

  let {
    composition,
    destinationName,
    renderScene,
  }: {
    composition: PostcardComposition
    destinationName: string
    renderScene: boolean
  } = $props()

  let canvas = $state<HTMLCanvasElement>()
  let renderFailed = $state(false)

  $effect(() => {
    if (!renderScene || !canvas) return
    const target = canvas
    const currentComposition = composition
    const currentDestinationName = destinationName
    let active = true
    renderFailed = false

    void renderPostcardCanvas(
      target,
      currentComposition,
      currentDestinationName,
      webPostcardCanvas,
    ).catch(() => {
      if (active) renderFailed = true
    })

    return () => {
      active = false
    }
  })
</script>

<article class:composited={renderScene} class="postcard">
  {#if renderScene}
    <div
      class="composite-frame"
      role="img"
      aria-label={`${destinationName}的旅行明信片：${composition.note}`}
    >
      <canvas
        bind:this={canvas}
        class="composite"
        aria-hidden="true"
      ></canvas>
    </div>
    {#if renderFailed}
      <p class="render-error">这张明信片暂时没有展开，请稍后再看。</p>
    {/if}
  {:else}
    <div class="picture">
      <div class="non-shipping-preview" aria-label="场景仍在发布审核中">
        <span></span>
      </div>
    </div>

    <div class="message">
      <div>
        <p>{composition.note}</p>
        <small>{destinationName}</small>
      </div>
      <span class="postmark" aria-label={`邮戳时间 ${composition.postmarkDate}`}>
        {composition.postmarkDate.slice(5).replace('-', '.')}
      </span>
    </div>
  {/if}
</article>

<style>
  .postcard {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(91, 83, 64, 0.3);
    border-radius: 8px;
    background:
      radial-gradient(rgba(97, 89, 69, 0.045) 0.7px, transparent 0.8px) 0 0 / 6px 6px,
      #f8efd8;
    box-shadow: 0 8px 18px rgba(72, 65, 47, 0.09);
  }

  .postcard.composited {
    aspect-ratio: 4 / 3;
    background: #e8e3d4;
  }

  .composite-frame,
  .composite {
    display: block;
    width: 100%;
    height: 100%;
  }

  .render-error {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    padding: 24px;
    background: rgba(248, 239, 216, 0.92);
    color: #727064;
    font-size: 0.72rem;
    text-align: center;
  }

  .picture {
    position: relative;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    background: #e8e3d4;
  }

  .non-shipping-preview {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background:
      linear-gradient(168deg, transparent 58%, rgba(116, 137, 97, 0.34) 59% 72%, transparent 73%),
      linear-gradient(188deg, transparent 48%, rgba(137, 158, 116, 0.28) 49% 67%, transparent 68%),
      linear-gradient(#dce8e2, #f0dfbc);
  }

  .non-shipping-preview span {
    position: absolute;
    top: 14%;
    right: 12%;
    width: 18%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: rgba(240, 193, 113, 0.4);
  }

  .message {
    display: grid;
    min-height: 82px;
    align-items: center;
    grid-template-columns: minmax(0, 1fr) 54px;
    gap: 12px;
    padding: 14px 16px;
  }

  .message p,
  .message small {
    margin: 0;
  }

  .message p {
    font-size: 0.82rem;
    line-height: 1.75;
    letter-spacing: 0.05em;
  }

  .message small {
    display: block;
    margin-top: 6px;
    color: #838273;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.61rem;
  }

  .postmark {
    display: grid;
    width: 51px;
    height: 51px;
    place-items: center;
    transform: rotate(-8deg);
    border: 2px solid rgba(161, 100, 82, 0.48);
    border-radius: 50%;
    color: rgba(142, 84, 69, 0.72);
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.56rem;
  }
</style>
