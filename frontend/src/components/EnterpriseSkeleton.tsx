import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function EnterpriseSkeleton() {
  return (
    <div className="w-full space-y-4 sm:space-y-5 fade-in pb-6">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-5">
        <Card className="rounded-lg">
          <CardHeader>
            <Skeleton className="h-7 w-48 rounded-md" />
            <Skeleton className="h-4 w-32 rounded-md mt-1" />
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Skeleton className="h-14 w-28 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-64 w-full max-w-[320px] rounded-lg" />
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardContent className="pt-5 space-y-4">
            <Skeleton className="h-5 w-32 rounded-md" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-5 w-16 rounded-md" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-lg" />
        ))}
      </div>

      <Card className="rounded-lg">
        <CardContent className="pt-5">
          <Skeleton className="h-5 w-24 rounded-md mb-3" />
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md mb-2" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
