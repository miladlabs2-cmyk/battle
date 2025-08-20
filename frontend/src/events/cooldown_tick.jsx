import SecondsProgress from '../components/SecondsProgress'

export default function Cooldown_tick({ data }) {
    const total = Number(data?.seconds ?? 0) || Number(data?.seconds_left ?? 0)
    const left = Number(data?.seconds_left ?? 0)

    return (
        <div className="p-4">
            <h2 className="text-lg font-semibold mb-2">cooldown_tick</h2>
            <SecondsProgress seconds={total} secondsLeft={left} barColor="bg-emerald-500" trackColor="bg-gray-300" />
        </div>
    )
}


